"""Sequência de follow-up (dia 0/3/7/14 configuráveis) com verificações antes de cada envio."""
from __future__ import annotations

import json
from datetime import datetime, timedelta

from ..compliance import lgpd, suppression
from ..crm import pipeline
from ..settings import iso, now, parse_dt
from . import composer, sender

CLOSE_AFTER_LAST_DAYS = 7


def schedule_sequence(app, lead_id: int, contact_id: int, *, start: datetime, origin_message_id: int) -> int:
    """Agenda as etapas seguintes ao contato inicial. Idempotente por dedupe_key."""
    created = 0
    steps = app.settings.outreach.get("followup_sequence", [])
    with app.db.transaction():
        for step in steps:
            if step["step"] == 0:
                continue
            payload = {"contact_id": contact_id, "step": step["step"], "template": step["template"],
                       "variant": step["variant"], "origin_message_id": origin_message_id}
            cur = app.db.execute(
                "INSERT OR IGNORE INTO tasks(lead_id, kind, due_at, status, payload, dedupe_key, created_at, updated_at) "
                "VALUES (?, 'followup', ?, 'PENDENTE', ?, ?, ?, ?)",
                (lead_id, iso(start + timedelta(days=int(step["day"]))), json.dumps(payload),
                 f"lead:{lead_id}:seq:{step['step']}", iso(), iso()))
            created += cur.rowcount
        if steps:
            last_day = max(int(s["day"]) for s in steps)
            app.db.execute(
                "INSERT OR IGNORE INTO tasks(lead_id, kind, due_at, status, payload, dedupe_key, created_at, updated_at) "
                "VALUES (?, 'close_no_reply', ?, 'PENDENTE', ?, ?, ?, ?)",
                (lead_id, iso(start + timedelta(days=last_day + CLOSE_AFTER_LAST_DAYS)),
                 json.dumps({"contact_id": contact_id, "origin_message_id": origin_message_id}),
                 f"lead:{lead_id}:close", iso(), iso()))
    return created


def cancel_sequence(app, lead_id: int, reason: str) -> int:
    with app.db.transaction():
        cur = app.db.execute("UPDATE tasks SET status='CANCELADA', result=?, updated_at=? WHERE lead_id=? "
                             "AND kind IN ('followup','close_no_reply') AND status IN ('PENDENTE','EM_EXECUCAO')",
                             (reason, iso(), lead_id))
        app.db.execute("UPDATE messages SET status='CANCELADA', error=?, updated_at=? WHERE lead_id=? "
                       "AND direction='OUT' AND kind='followup' AND status IN "
                       "('RASCUNHO','AGUARDANDO_APROVACAO','PRONTA','PENDENTE_INTEGRACAO','FALHOU')",
                       (reason, iso(), lead_id))
        if cur.rowcount:
            app.db.audit("sequencia_cancelada", "leads", lead_id, {"motivo": reason, "tarefas": cur.rowcount})
    return cur.rowcount


def _finish_task(app, task_id: int, status: str, result: str) -> None:
    with app.db.transaction():
        app.db.execute("UPDATE tasks SET status=?, result=?, updated_at=? WHERE id=?", (status, result, iso(), task_id))


def _stop_reason(app, task, payload) -> str | None:
    """Verificações obrigatórias antes de cada follow-up."""
    db = app.db
    lead = db.one("SELECT * FROM leads WHERE id=?", (task["lead_id"],))
    origin = db.one("SELECT * FROM messages WHERE id=?", (payload["origin_message_id"],))
    if origin is None or origin["status"] != "ENVIADA":
        return "contato inicial não consta como enviado"
    replied = db.scalar("SELECT COUNT(*) FROM messages WHERE lead_id=? AND direction='IN' AND created_at >= ?",
                        (lead["id"], origin["sent_at"]))
    if replied:
        return "destinatário já respondeu"
    if lead["status"] != pipeline.CONTATADO:
        return f"oportunidade em estado {lead['status']}"
    contact = db.one("SELECT * FROM contacts WHERE id=?", (payload["contact_id"],))
    if contact is None:
        return "contato removido"
    blocked, why = suppression.is_suppressed(app, email=contact["email"])
    if blocked:
        return why
    ok, why = lgpd.has_valid_basis(app, contact["id"])
    if not ok:
        return why
    if not app.settings.outreach.get("channels", {}).get("email", {}).get("enabled", False):
        return "canal de e-mail desativado na configuração"
    return None


def run_due(app) -> dict:
    db = app.db
    stats = {"preparados": 0, "enviados": 0, "cancelados": 0, "adiados": 0, "encerrados_sem_resposta": 0}
    due = db.all("SELECT * FROM tasks WHERE status='PENDENTE' AND kind IN ('followup','close_no_reply') "
                 "AND due_at <= ? ORDER BY due_at", (iso(),))
    for task in due:
        with db.transaction():
            claimed = db.execute("UPDATE tasks SET status='EM_EXECUCAO', updated_at=? WHERE id=? AND status='PENDENTE'",
                                 (iso(), task["id"])).rowcount
        if not claimed:
            continue
        payload = json.loads(task["payload"] or "{}")

        if task["kind"] == "close_no_reply":
            lead = db.one("SELECT status FROM leads WHERE id=?", (task["lead_id"],))
            replied = db.scalar("SELECT COUNT(*) FROM messages WHERE lead_id=? AND direction='IN'", (task["lead_id"],))
            if lead["status"] == pipeline.CONTATADO and not replied:
                pipeline.transition(app, task["lead_id"], pipeline.PERDIDO, evidence_type="sem_resposta",
                                    evidence_ref=f"tarefa:{task['id']}", reason="sequência encerrada sem resposta")
                stats["encerrados_sem_resposta"] += 1
                _finish_task(app, task["id"], "CONCLUIDA", "lead marcado como PERDIDO (sem resposta)")
            else:
                _finish_task(app, task["id"], "CANCELADA", f"lead em {lead['status']}")
            continue

        reason = _stop_reason(app, task, payload)
        if reason:
            cancel_sequence(app, task["lead_id"], reason)
            _finish_task(app, task["id"], "CANCELADA", reason)
            stats["cancelados"] += 1
            continue

        # Etapa anterior precisa ter sido enviada (não "pular" mensagens nem acumular).
        prev = db.one("SELECT status FROM messages WHERE lead_id=? AND direction='OUT' AND step=? "
                      "ORDER BY id DESC LIMIT 1", (task["lead_id"], int(payload["step"]) - 1))
        if prev is not None and prev["status"] != "ENVIADA":
            with db.transaction():
                db.execute("UPDATE tasks SET status='PENDENTE', due_at=?, updated_at=? WHERE id=?",
                           (iso(now() + timedelta(hours=2)), iso(), task["id"]))
            stats["adiados"] += 1
            continue

        key = f"lead:{task['lead_id']}:seq:{payload['step']}"
        try:
            message_id, _ = sender.compose_and_create(
                app, lead_id=task["lead_id"], contact_id=payload["contact_id"], template=payload["template"],
                variant=payload["variant"], kind="followup", step=int(payload["step"]), idempotency_key=key)
        except composer.TemplateError as exc:
            _finish_task(app, task["id"], "FALHOU", f"modelo: {exc}")
            app.log.error("follow-up do lead #%s não renderizado: %s", task["lead_id"], exc)
            continue
        stats["preparados"] += 1
        result = sender.dispatch(app, message_id)
        if result.sent:
            stats["enviados"] += 1
        _finish_task(app, task["id"], "CONCLUIDA", f"mensagem #{message_id}: {result.status} ({result.reason})")
    return stats


def next_due(app, lead_id: int) -> datetime | None:
    value = app.db.scalar("SELECT MIN(due_at) FROM tasks WHERE lead_id=? AND status='PENDENTE'", (lead_id,))
    return parse_dt(value)
