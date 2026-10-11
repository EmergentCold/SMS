"""Reuniões: registro, convite .ics e mensagem de confirmação (ação 'schedule_meeting', nível 2)."""
from __future__ import annotations

from datetime import datetime, timedelta

from ..crm import pipeline, repository
from ..integrations.calendar import write_ics
from ..settings import iso, parse_dt
from . import sender


def create_meeting(app, lead_id: int, starts_at: datetime, *, duration_min: int = 30,
                   location: str = "Videochamada (link enviado na confirmação)") -> dict:
    db = app.db
    lead = db.one("SELECT * FROM leads WHERE id=?", (lead_id,))
    if lead is None:
        raise ValueError(f"lead #{lead_id} não existe")
    if lead["status"] not in (pipeline.RESPONDEU, pipeline.REUNIAO, pipeline.PROPOSTA, pipeline.NEGOCIACAO):
        raise ValueError(f"reunião exige que o lead tenha respondido (atual: {lead['status']})")
    contact = repository.primary_contact(app, lead_id)
    if contact is None:
        raise ValueError("lead sem contato ativo")
    ends_at = starts_at + timedelta(minutes=duration_min)
    with db.transaction():
        meeting_id = db.insert("meetings", {"lead_id": lead_id, "starts_at": iso(starts_at), "ends_at": iso(ends_at),
                                            "location": location, "status": "PROPOSTA",
                                            "created_at": iso(), "updated_at": iso()})
    view = repository.lead_view(app, lead_id)
    ics = write_ics(app.settings.data_dir / "meetings" / f"reuniao-{meeting_id}.ics",
                    uid=f"meeting-{meeting_id}@sst-agent", start=starts_at, end=ends_at,
                    summary=f"Conversa sobre SST — {view['company_name']}",
                    description="Conversa inicial sobre consultoria em Segurança e Saúde no Trabalho.",
                    location=location, organizer_email=app.settings.business.get("brand", {}).get("commercial_email"),
                    attendee_email=contact["email"])
    with db.transaction():
        db.execute("UPDATE meetings SET ics_path=? WHERE id=?", (str(ics), meeting_id))
    message_id, _ = sender.compose_and_create(
        app, lead_id=lead_id, contact_id=contact["id"], template="meeting_confirmation", variant="default",
        kind="meeting", idempotency_key=f"meeting:{meeting_id}:confirm",
        extra_vars={"meeting_date": starts_at.strftime("%d/%m/%Y"), "meeting_time": starts_at.strftime("%H:%M"),
                    "meeting_location": location, "meeting_duration": f"{duration_min} minutos"})
    result = sender.dispatch(app, message_id)
    return {"meeting_id": meeting_id, "ics": str(ics), "message_id": message_id, "envio": result.status,
            "motivo": result.reason}


def mark_confirmed(app, message_id: int) -> None:
    msg = app.db.one("SELECT * FROM messages WHERE id=?", (message_id,))
    meeting_id = int(msg["idempotency_key"].split(":")[1])
    with app.db.transaction():
        app.db.execute("UPDATE meetings SET status='CONFIRMADA', updated_at=? WHERE id=?", (iso(), meeting_id))
    lead = app.db.one("SELECT status FROM leads WHERE id=?", (msg["lead_id"],))
    if lead["status"] == pipeline.RESPONDEU:
        pipeline.transition(app, msg["lead_id"], pipeline.REUNIAO, evidence_type="reuniao",
                            evidence_ref=meeting_id, reason="reunião confirmada")


def mark_held(app, meeting_id: int) -> None:
    """Somente o proprietário registra que a reunião aconteceu (nunca o agente)."""
    row = app.db.one("SELECT * FROM meetings WHERE id=?", (meeting_id,))
    if row is None or parse_dt(row["starts_at"]) is None:
        raise ValueError("reunião inexistente")
    with app.db.transaction():
        app.db.execute("UPDATE meetings SET status='REALIZADA', updated_at=? WHERE id=?", (iso(), meeting_id))
        app.db.audit("reuniao_realizada", "meetings", meeting_id, actor="proprietario")
