"""Níveis de autonomia, fila de aprovações e interruptor de emergência (kill switch)."""
from __future__ import annotations

import json
from dataclasses import dataclass
from enum import Enum

from ..settings import env_bool, iso


class Decision(str, Enum):
    ALLOW = "PERMITIDO"
    NEEDS_APPROVAL = "REQUER_APROVACAO"
    HUMAN_ONLY = "SOMENTE_HUMANO"


@dataclass
class PermissionResult:
    decision: Decision
    level: int
    reason: str

    @property
    def allowed(self) -> bool:
        return self.decision is Decision.ALLOW


def check(app, action: str) -> PermissionResult:
    spec = app.settings.autonomy.get("actions", {}).get(action)
    if spec is None:
        return PermissionResult(Decision.NEEDS_APPROVAL, 3, f"ação '{action}' não configurada: exige aprovação")
    level = int(spec.get("level", 3))
    if level == 1:
        return PermissionResult(Decision.ALLOW, 1, "nível 1: automático")
    if level == 2:
        if spec.get("enabled") is True:
            return PermissionResult(Decision.ALLOW, 2, "nível 2 habilitado em config/autonomy.json")
        return PermissionResult(Decision.NEEDS_APPROVAL, 2, "nível 2 desabilitado: vai para a fila de aprovação")
    if spec.get("human_only"):
        return PermissionResult(Decision.HUMAN_ONLY, 3, "nível 3: somente o proprietário executa")
    return PermissionResult(Decision.NEEDS_APPROVAL, 3, "nível 3: exige validação humana")


# --------------------------------------------------------------------------- aprovações
def request_approval(app, action: str, subject_type: str, subject_id: int, summary: str,
                     payload: dict | None = None) -> int:
    """Cria (ou reaproveita) um pedido pendente. Idempotente por (ação, assunto)."""
    db = app.db
    existing = db.one("SELECT id FROM approvals WHERE action=? AND subject_type=? AND subject_id=? "
                      "AND status='PENDENTE'", (action, subject_type, subject_id))
    if existing:
        return int(existing["id"])
    level = check(app, action).level
    with db.transaction():
        approval_id = db.insert("approvals", {
            "action": action, "level": level, "subject_type": subject_type, "subject_id": subject_id,
            "summary": summary, "payload": json.dumps(payload or {}, ensure_ascii=False, default=str),
            "status": "PENDENTE", "created_at": iso(),
        })
        db.audit("aprovacao_solicitada", "approvals", approval_id, {"action": action, "summary": summary})
    app.log.info("Aprovação pendente #%s: %s", approval_id, summary)
    return approval_id


def approval_status(app, action: str, subject_type: str, subject_id: int) -> str | None:
    row = app.db.one("SELECT status FROM approvals WHERE action=? AND subject_type=? AND subject_id=? "
                     "ORDER BY id DESC LIMIT 1", (action, subject_type, subject_id))
    return None if row is None else row["status"]


def is_approved(app, action: str, subject_type: str, subject_id: int) -> bool:
    return approval_status(app, action, subject_type, subject_id) == "APROVADO"


def decide(app, approval_id: int, approve: bool, by: str = "proprietario", note: str | None = None) -> dict:
    db = app.db
    row = db.one("SELECT * FROM approvals WHERE id=?", (approval_id,))
    if row is None:
        raise ValueError(f"aprovação #{approval_id} não existe")
    if row["status"] != "PENDENTE":
        raise ValueError(f"aprovação #{approval_id} já decidida: {row['status']}")
    status = "APROVADO" if approve else "REJEITADO"
    with db.transaction():
        db.execute("UPDATE approvals SET status=?, decided_by=?, note=?, decided_at=? WHERE id=?",
                   (status, by, note, iso(), approval_id))
        db.audit("aprovacao_decidida", "approvals", approval_id, {"status": status, "note": note}, actor=by)
    return dict(row) | {"status": status}


def authorize(app, action: str, subject_type: str, subject_id: int, summary: str,
              payload: dict | None = None) -> tuple[bool, str]:
    """Combina nível de autonomia e aprovação específica do assunto.

    Retorna (pode_executar, situação). Nunca executa ações 'human_only'.
    """
    result = check(app, action)
    if result.decision is Decision.ALLOW:
        return True, result.reason
    if result.decision is Decision.HUMAN_ONLY:
        request_approval(app, action, subject_type, subject_id, summary, payload)
        return False, result.reason
    status = approval_status(app, action, subject_type, subject_id)
    if status == "APROVADO":
        return True, "aprovado pelo proprietário"
    if status == "REJEITADO":
        return False, "rejeitado pelo proprietário"
    request_approval(app, action, subject_type, subject_id, summary, payload)
    return False, result.reason


# --------------------------------------------------------------------------- kill switch
def is_paused(app) -> tuple[bool, str]:
    if env_bool("KILL_SWITCH", False):
        return True, "variável KILL_SWITCH ativa"
    if app.settings.kill_switch_file.exists():
        return True, f"arquivo {app.settings.kill_switch_file.name} presente"
    if app.db.get_meta("kill_switch") == "1":
        return True, app.db.get_meta("kill_switch_reason") or "kill switch ativo"
    return False, ""


def set_kill_switch(app, on: bool, reason: str = "", actor: str = "proprietario") -> None:
    db = app.db
    with db.transaction():
        db.set_meta("kill_switch", "1" if on else "0")
        db.set_meta("kill_switch_reason", reason or ("pausado manualmente" if on else ""))
        db.audit("kill_switch_" + ("on" if on else "off"), details={"reason": reason}, actor=actor)
    if on:
        app.settings.kill_switch_file.write_text(f"{iso()} {reason}\n", encoding="utf-8")
    else:
        app.settings.kill_switch_file.unlink(missing_ok=True)
