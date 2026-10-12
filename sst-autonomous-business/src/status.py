"""Visão geral do sistema (usada pela CLI `status`, pela API e pelo painel JavaScript)."""
from __future__ import annotations


def status_payload(app) -> dict:
    from .compliance import permissions
    from .scheduler import Scheduler

    db = app.db
    paused, why = permissions.is_paused(app)
    lock = db.one("SELECT owner, heartbeat_at FROM scheduler_lock WHERE id=1")
    return {
        "banco": str(app.settings.db_path),
        "simulacao": app.settings.simulation,
        "envio_externo_habilitado": app.settings.external_sending_enabled,
        "kill_switch": {"ativo": paused, "motivo": why},
        "identidade_configurada": app.settings.owner_identity_configured(),
        "agendador": dict(lock) if lock else "parado",
        "leads_por_estado": {r["status"]: r["n"] for r in db.all("SELECT status, COUNT(*) n FROM leads GROUP BY status")},
        "mensagens_por_estado": {r["status"]: r["n"] for r in db.all(
            "SELECT status, COUNT(*) n FROM messages WHERE direction='OUT' GROUP BY status")},
        "aprovacoes_pendentes": db.scalar("SELECT COUNT(*) FROM approvals WHERE status='PENDENTE'"),
        "integracoes_pendentes": [dict(r) for r in db.all("SELECT name, reason, action_needed FROM pending_integrations")],
        "ultimos_jobs": [dict(r) for r in db.all("SELECT job_name, scheduled_for, status FROM job_runs "
                                                 "ORDER BY id DESC LIMIT 8")],
        "proximos_jobs": Scheduler(app, jobs={}).upcoming(),
    }
