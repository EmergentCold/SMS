"""Ponte por arquivos com o Power Automate (funciona com licença padrão do Microsoft 365).

Fluxo: Power Apps → fluxo do Power Automate → cria `<pasta>/inbox/<id>.json` no OneDrive/SharePoint →
o OneDrive sincroniza com o computador do agente → este módulo processa o comando → move o arquivo para
`inbox/processados/` (ou `inbox/falhas/`) e grava o resultado em `outbox/<id>.result.json`.

Nenhuma porta de rede é aberta. Cada comando é idempotente pelo campo `id`.

Formato do comando (JSON):
  {"id": "guid", "type": "...", "by": "email@empresa", "token": "<SST_BRIDGE_TOKEN, se configurado>", ...}

Tipos aceitos:
  approval_decision  {"approval_id": 3, "approve": true, "note": "..."}
  kill_switch        {"on": true, "reason": "..."}
  inbound_message    {"from": "...", "subject": "...", "body": "...", "message_id": "..."}
  leads_import       {"rows": [ {name, website, segment, city, contact_email, source_url, ...} ]}
  run_job            {"name": "qualify" | "outreach" | "followups" | "daily_report" | "powerbi_export" | "recover"}
"""
from __future__ import annotations

import hmac
import json
import os
import re
import shutil
import time
from pathlib import Path

from ..settings import env, iso, redact
from . import export

ALLOWED_JOBS = {"qualify", "outreach", "followups", "daily_report", "weekly_report", "powerbi_export", "recover"}
SAFE_ID = re.compile(r"^[A-Za-z0-9_\-{}]{1,80}$")
MAX_BYTES = 2_000_000
SETTLE_SECONDS = 3  # idade mínima do arquivo antes de processar


class CommandError(ValueError):
    pass


def execute(app, command: dict, *, channel: str = "ponte") -> dict:
    """Executa um comando já validado (usado pela ponte de arquivos e pela API REST)."""
    from ..compliance import permissions
    from ..outreach import inbound
    from ..proposals import generator
    from ..research import importer

    ctype = command.get("type")
    by = str(command.get("by") or "power-platform")[:120]
    if ctype == "approval_decision":
        approval_id = int(command["approval_id"])
        approve = command.get("approve")
        if not isinstance(approve, bool):
            raise CommandError("'approve' deve ser true ou false")
        result = permissions.decide(app, approval_id, approve, by=f"{channel}:{by}", note=command.get("note"))
        generator.refresh_approvals(app)
        return {"approval_id": approval_id, "status": result["status"]}
    if ctype == "kill_switch":
        on = command.get("on")
        if not isinstance(on, bool):
            raise CommandError("'on' deve ser true ou false")
        permissions.set_kill_switch(app, on, str(command.get("reason") or f"via {channel}"), actor=f"{channel}:{by}")
        paused, why = permissions.is_paused(app)
        return {"envios_pausados": paused, "motivo": why}
    if ctype == "inbound_message":
        sender = command.get("from")
        if not sender:
            raise CommandError("'from' é obrigatório")
        return inbound.register_inbound(app, from_address=str(sender), subject=str(command.get("subject") or ""),
                                        body=str(command.get("body") or ""), message_id=command.get("message_id"),
                                        in_reply_to=command.get("in_reply_to"))
    if ctype == "leads_import":
        rows = command.get("rows")
        if not isinstance(rows, list) or not rows:
            raise CommandError("'rows' deve ser uma lista não vazia")
        if len(rows) > 2000:
            raise CommandError("máximo de 2000 linhas por comando")
        return importer.import_rows(app, rows, source_kind="power_platform", origin=f"{channel}:{by}")
    if ctype == "run_job":
        from ..scheduler import job_table
        name = command.get("name")
        if name not in ALLOWED_JOBS:
            raise CommandError(f"job não permitido: {name}")
        return {"job": name, "resultado": job_table(app)[name]()}
    raise CommandError(f"tipo de comando desconhecido: {ctype}")


def _check_token(command: dict) -> None:
    expected = env("SST_BRIDGE_TOKEN")
    if expected and not hmac.compare_digest(str(command.get("token") or ""), expected):
        raise CommandError("token da ponte inválido ou ausente")


def process_inbox(app) -> dict:
    root = export.export_dir(app)
    inbox, outbox = root / "inbox", root / "outbox"
    done, failed = inbox / "processados", inbox / "falhas"
    for folder in (inbox, outbox, done, failed):
        folder.mkdir(parents=True, exist_ok=True)
    stats = {"processados": 0, "falhas": 0, "duplicados": 0}
    for path in sorted(inbox.glob("*.json"), key=lambda p: p.stat().st_mtime):
        result: dict
        target = failed
        if time.time() - path.stat().st_mtime < SETTLE_SECONDS:
            stats["aguardando_sincronizacao"] = stats.get("aguardando_sincronizacao", 0) + 1
            continue  # o OneDrive pode ainda estar gravando o arquivo; processa no próximo ciclo
        try:
            if path.stat().st_size > MAX_BYTES:
                raise CommandError("arquivo maior que 2 MB")
            command = json.loads(path.read_text(encoding="utf-8-sig"))
            if not isinstance(command, dict):
                raise CommandError("o comando deve ser um objeto JSON")
            cmd_id = str(command.get("id") or path.stem)
            if not SAFE_ID.match(cmd_id):
                raise CommandError("id inválido (use letras, números, - ou _)")
            _check_token(command)
            key = f"bridge:{cmd_id}"
            if app.db.get_meta(key):
                result = {"status": "duplicado", "id": cmd_id, "resultado_anterior": json.loads(app.db.get_meta(key))}
                stats["duplicados"] += 1
                target = done
            else:
                output = execute(app, command)
                result = {"status": "ok", "id": cmd_id, "tipo": command.get("type"), "resultado": output,
                          "processado_em": iso()}
                with app.db.transaction():
                    app.db.set_meta(key, json.dumps(result, ensure_ascii=False, default=str)[:20000])
                    app.db.audit("ponte_power_platform", "bridge", cmd_id, {"tipo": command.get("type"),
                                                                            "por": command.get("by")})
                stats["processados"] += 1
                target = done
        except (CommandError, ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
            result = {"status": "erro", "arquivo": path.name, "erro": redact(f"{type(exc).__name__}: {exc}"),
                      "processado_em": iso()}
            stats["falhas"] += 1
            app.log.warning("ponte: comando %s rejeitado: %s", path.name, result["erro"])
        except Exception as exc:  # noqa: BLE001 - erro inesperado: isola o arquivo para não repetir a cada minuto
            result = {"status": "erro_interno", "arquivo": path.name, "erro": redact(f"{type(exc).__name__}: {exc}"),
                      "processado_em": iso()}
            stats["falhas"] += 1
            app.log.error("ponte: erro interno ao processar %s: %s", path.name, result["erro"])
        (outbox / f"{path.stem}.result.json").write_text(
            json.dumps(result, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
        dest = target / path.name
        if dest.exists():
            dest = target / f"{path.stem}-{iso().replace(':', '')}.json"
        shutil.move(str(path), dest)
    if stats["processados"]:
        export.export_all(app)  # devolve o estado atualizado ao Power Apps/Power BI
    else:
        stats["aprovacoes"] = export.sync_approval_files(app)
    return stats


def write_command(folder: Path, command: dict) -> Path:
    """Ajuda para testes e scripts: grava um comando de forma atômica."""
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{command['id']}.json"
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(command, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, path)
    return path
