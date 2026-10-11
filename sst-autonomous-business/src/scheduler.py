"""Agendador persistente (sem dependências): cron no fuso America/Sao_Paulo + execuções gravadas no SQLite.

- Cada disparo é identificado por (job, horário previsto) com chave única → nunca roda duas vezes.
- Após reinício, executa uma vez o disparo perdido mais recente dentro de `misfire_grace_minutes`
  (disparos mais antigos são ignorados, para não acumular envios).
- Trava de instância única com heartbeat (dois processos não operam ao mesmo tempo).
- Sinais SIGTERM/SIGINT encerram com segurança ao fim do job corrente.
"""
from __future__ import annotations

import os
import signal
import socket
import time as _time
import traceback
from datetime import datetime, timedelta
from typing import Callable

from .settings import iso, now, parse_dt, redact

LOCK_STALE = timedelta(minutes=3)


# --------------------------------------------------------------------------- cron
def _parse_field(spec: str, lo: int, hi: int) -> set[int]:
    values: set[int] = set()
    for part in spec.split(","):
        step = 1
        if "/" in part:
            part, step_s = part.split("/", 1)
            step = int(step_s)
        if part in ("*", ""):
            start, end = lo, hi
        elif "-" in part:
            a, b = part.split("-", 1)
            start, end = int(a), int(b)
        else:
            start = end = int(part)
        if start < lo or end > hi or start > end:
            raise ValueError(f"campo cron fora do intervalo: {spec}")
        values.update(range(start, end + 1, step))
    return values


class Cron:
    def __init__(self, expr: str) -> None:
        fields = expr.split()
        if len(fields) != 5:
            raise ValueError(f"expressão cron inválida: {expr}")
        self.expr = expr
        self.minutes = _parse_field(fields[0], 0, 59)
        self.hours = _parse_field(fields[1], 0, 23)
        self.days = _parse_field(fields[2], 1, 31)
        self.months = _parse_field(fields[3], 1, 12)
        dows = _parse_field(fields[4].replace("7", "0"), 0, 6)
        self.dows = dows
        self.dom_any, self.dow_any = fields[2] == "*", fields[4] == "*"

    def matches(self, dt: datetime) -> bool:
        if dt.minute not in self.minutes or dt.hour not in self.hours or dt.month not in self.months:
            return False
        cron_dow = (dt.weekday() + 1) % 7  # Python: seg=0; cron: dom=0
        dom_ok, dow_ok = dt.day in self.days, cron_dow in self.dows
        if self.dom_any or self.dow_any:
            return dom_ok and dow_ok
        return dom_ok or dow_ok

    def previous(self, ref: datetime, within: timedelta) -> datetime | None:
        """Último horário previsto ≤ ref dentro da janela."""
        dt = ref.replace(second=0, microsecond=0)
        limit = ref - within
        while dt >= limit:
            if self.matches(dt):
                return dt
            dt -= timedelta(minutes=1)
        return None

    def next(self, ref: datetime, horizon_days: int = 8) -> datetime | None:
        dt = ref.replace(second=0, microsecond=0) + timedelta(minutes=1)
        end = ref + timedelta(days=horizon_days)
        while dt <= end:
            if self.matches(dt):
                return dt
            dt += timedelta(minutes=1)
        return None


# --------------------------------------------------------------------------- jobs
def job_table(app) -> dict[str, Callable[[], object]]:
    from .analytics import reports
    from .compliance import lgpd
    from .crm import scoring
    from .outreach import followup, inbound, sender
    from .proposals import generator
    from .research import discovery

    def research():
        return {"descoberta": discovery.run(app), "enriquecimento": discovery.enrich_pending(app)}

    def backup():
        keep = int(app.settings.business.get("retention", {}).get("backups_keep", 14))
        return str(app.db.backup(app.settings.data_dir / "backups", keep))

    def recover():
        return {"recuperacao": sender.recover_stuck(app), "propostas_expiradas": generator.expire_old(app),
                "propostas_liberadas": generator.refresh_approvals(app)}

    return {
        "research": research,
        "qualify": lambda: scoring.qualify_pending(app),
        "outreach": lambda: sender.run_outreach(app),
        "inbound": lambda: inbound.poll_inbox(app),
        "followups": lambda: followup.run_due(app),
        "recover": recover,
        "daily_report": lambda: [str(p) for p in reports.build(app, "diario")],
        "weekly_report": lambda: [str(p) for p in reports.build(app, "semanal")],
        "backup": backup,
        "retention": lambda: lgpd.apply_retention(app),
    }


class Scheduler:
    def __init__(self, app, jobs: dict[str, Callable[[], object]] | None = None) -> None:
        self.app = app
        cfg = app.settings.schedule
        self.tick = float(cfg.get("tick_seconds", 30))
        self.grace = timedelta(minutes=int(cfg.get("misfire_grace_minutes", 180)))
        self.specs = [(j["name"], Cron(j["cron"]), j["command"]) for j in cfg["jobs"]]
        self.jobs = jobs if jobs is not None else job_table(app)
        self.owner = f"{socket.gethostname()}:{os.getpid()}"
        self._stop = False

    # ------------------------------------------------------------------ trava
    def acquire_lock(self) -> bool:
        db = self.app.db
        with db.transaction():
            row = db.one("SELECT owner, heartbeat_at FROM scheduler_lock WHERE id=1")
            if row and row["owner"] != self.owner and now() - parse_dt(row["heartbeat_at"]) < LOCK_STALE:
                return False
            db.execute("INSERT INTO scheduler_lock(id, owner, heartbeat_at) VALUES (1, ?, ?) "
                       "ON CONFLICT(id) DO UPDATE SET owner=excluded.owner, heartbeat_at=excluded.heartbeat_at",
                       (self.owner, iso()))
        return True

    def heartbeat(self) -> None:
        with self.app.db.transaction():
            self.app.db.execute("UPDATE scheduler_lock SET heartbeat_at=? WHERE id=1 AND owner=?", (iso(), self.owner))

    def release_lock(self) -> None:
        with self.app.db.transaction():
            self.app.db.execute("DELETE FROM scheduler_lock WHERE id=1 AND owner=?", (self.owner,))

    # ------------------------------------------------------------------ execução
    def due_runs(self, ref: datetime | None = None) -> list[tuple[str, str, datetime]]:
        ref = ref or now()
        out = []
        for name, cron, command in self.specs:
            slot = cron.previous(ref, self.grace)
            if slot is None:
                continue
            exists = self.app.db.one("SELECT 1 FROM job_runs WHERE job_name=? AND scheduled_for=?", (name, iso(slot)))
            if not exists:
                out.append((name, command, slot))
        return out

    def run_job(self, name: str, command: str, slot: datetime) -> str:
        db = self.app.db
        with db.transaction():
            cur = db.execute("INSERT OR IGNORE INTO job_runs(job_name, scheduled_for, status, started_at) "
                             "VALUES (?, ?, 'EXECUTANDO', ?)", (name, iso(slot), iso()))
        if cur.rowcount != 1:
            return "JA_EXECUTADO"
        func = self.jobs.get(command)
        try:
            if func is None:
                raise KeyError(f"comando desconhecido: {command}")
            result = func()
            status, detail = "OK", redact(str(result))[:2000]
        except Exception as exc:  # noqa: BLE001 - registrar e seguir com os demais jobs
            status = "FALHOU"
            detail = redact(f"{type(exc).__name__}: {exc}")[:2000]
            self.app.log.error("job %s falhou: %s\n%s", name, detail, redact(traceback.format_exc())[-1500:])
        with db.transaction():
            db.execute("UPDATE job_runs SET status=?, finished_at=?, detail=? WHERE job_name=? AND scheduled_for=?",
                       (status, iso(), detail, name, iso(slot)))
        self.app.log.info("job %s (%s): %s", name, iso(slot), status)
        return status

    def recover_interrupted(self) -> int:
        """Jobs que estavam EXECUTANDO quando o processo caiu: marca como FALHOU para aparecer no relatório."""
        with self.app.db.transaction():
            cur = self.app.db.execute("UPDATE job_runs SET status='FALHOU', finished_at=?, detail=? "
                                      "WHERE status='EXECUTANDO'", (iso(), "processo interrompido durante o job"))
        return cur.rowcount

    def run_once(self, ref: datetime | None = None) -> list[tuple[str, str]]:
        results = []
        for name, command, slot in self.due_runs(ref):
            if self._stop:
                break
            results.append((name, self.run_job(name, command, slot)))
        return results

    def request_stop(self, *_args) -> None:
        self.app.log.info("encerramento solicitado; finalizando após o job atual")
        self._stop = True

    def serve_forever(self) -> None:
        if not self.acquire_lock():
            raise RuntimeError("outro agendador está ativo (trava em scheduler_lock). Use `status` para verificar.")
        signal.signal(signal.SIGTERM, self.request_stop)
        signal.signal(signal.SIGINT, self.request_stop)
        interrupted = self.recover_interrupted()
        if interrupted:
            self.app.log.error("%s job(s) interrompido(s) na execução anterior", interrupted)
        from .outreach import sender
        sender.recover_stuck(self.app)
        self.app.log.info("agendador iniciado (%s); %s jobs", self.owner, len(self.specs))
        try:
            while not self._stop:
                if self.app.db.get_meta("scheduler_stop_requested") == "1":
                    with self.app.db.transaction():
                        self.app.db.set_meta("scheduler_stop_requested", "0")
                    self.app.log.info("parada solicitada via comando `stop`")
                    break
                self.heartbeat()
                self.run_once()
                for _ in range(int(self.tick)):
                    if self._stop:
                        break
                    _time.sleep(1)
        finally:
            self.release_lock()
            self.app.log.info("agendador encerrado")

    def upcoming(self) -> list[dict]:
        ref = now()
        return [{"job": name, "cron": cron.expr, "proxima": iso(cron.next(ref)) if cron.next(ref) else None}
                for name, cron, _ in self.specs]
