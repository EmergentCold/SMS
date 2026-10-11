"""Agenda: gera convites .ics (funciona sem credenciais). Calendário externo é opcional."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from ..settings import env
from .base import IntegrationStatus


def _ics_dt(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def write_ics(path: Path, *, uid: str, start: datetime, end: datetime, summary: str, description: str,
              location: str, organizer_email: str | None, attendee_email: str | None) -> Path:
    lines = [
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SST Business Agent//PT-BR", "METHOD:REQUEST",
        "BEGIN:VEVENT", f"UID:{uid}", f"DTSTAMP:{_ics_dt(datetime.now(timezone.utc))}",
        f"DTSTART:{_ics_dt(start)}", f"DTEND:{_ics_dt(end)}", f"SUMMARY:{_escape(summary)}",
        f"DESCRIPTION:{_escape(description)}", f"LOCATION:{_escape(location)}",
    ]
    if organizer_email:
        lines.append(f"ORGANIZER:mailto:{organizer_email}")
    if attendee_email:
        lines.append(f"ATTENDEE;RSVP=TRUE:mailto:{attendee_email}")
    lines += ["END:VEVENT", "END:VCALENDAR"]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\r\n".join(lines) + "\r\n", encoding="utf-8")
    return path


class ExternalCalendar:
    name = "agenda_externa"

    def is_configured(self) -> bool:
        return bool(env("CALENDAR_PROVIDER") and env("CALENDAR_CREDENTIALS_FILE"))

    def verify(self) -> IntegrationStatus:
        if not self.is_configured():
            return IntegrationStatus(self.name, False, None, "convites .ics locais ativos; agenda externa não conectada",
                                     "opcional: configurar OAuth (Google/Microsoft) e CALENDAR_PROVIDER")
        return IntegrationStatus(self.name, True, None, "declarado; sincronização ainda não implementada")
