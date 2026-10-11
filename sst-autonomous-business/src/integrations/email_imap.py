"""Leitura de respostas via IMAP (somente leitura; marca como lida).

Variáveis: IMAP_HOST, IMAP_PORT (993), IMAP_USER, IMAP_PASSWORD, IMAP_FOLDER (INBOX).
"""
from __future__ import annotations

import email
import imaplib
from dataclasses import dataclass
from email.header import decode_header, make_header
from email.utils import parseaddr

from ..settings import env
from .base import IntegrationStatus, NotConfigured


@dataclass
class InboundEmail:
    from_address: str
    subject: str
    body: str
    message_id: str | None
    in_reply_to: str | None


def _text_body(msg: email.message.Message) -> str:
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain" and "attachment" not in str(part.get("Content-Disposition")):
                payload = part.get_payload(decode=True) or b""
                return payload.decode(part.get_content_charset() or "utf-8", errors="replace")
        return ""
    payload = msg.get_payload(decode=True) or b""
    return payload.decode(msg.get_content_charset() or "utf-8", errors="replace")


class ImapInbox:
    name = "email_imap"

    def __init__(self) -> None:
        self.host = env("IMAP_HOST")
        self.port = int(env("IMAP_PORT", "993"))
        self.user = env("IMAP_USER")
        self.password = env("IMAP_PASSWORD")
        self.folder = env("IMAP_FOLDER", "INBOX")

    def is_configured(self) -> bool:
        return all([self.host, self.user, self.password])

    def verify(self) -> IntegrationStatus:
        if not self.is_configured():
            return IntegrationStatus(self.name, False, None, "credenciais ausentes",
                                     "definir IMAP_HOST, IMAP_USER, IMAP_PASSWORD no .env")
        try:
            with imaplib.IMAP4_SSL(self.host, self.port) as conn:
                conn.login(self.user, self.password)
                conn.select(self.folder, readonly=True)
            return IntegrationStatus(self.name, True, True, f"login IMAP ok em {self.host}")
        except Exception as exc:  # noqa: BLE001
            return IntegrationStatus(self.name, True, False, f"falha IMAP: {type(exc).__name__}",
                                     "conferir host/usuário/senha de app")

    def fetch_unseen(self, limit: int = 50) -> list[InboundEmail]:
        if not self.is_configured():
            raise NotConfigured("IMAP não configurado")
        out: list[InboundEmail] = []
        with imaplib.IMAP4_SSL(self.host, self.port) as conn:
            conn.login(self.user, self.password)
            conn.select(self.folder)
            _, data = conn.search(None, "UNSEEN")
            for num in (data[0].split() if data and data[0] else [])[:limit]:
                _, parts = conn.fetch(num, "(RFC822)")
                raw = parts[0][1] if parts and parts[0] else b""
                msg = email.message_from_bytes(raw)
                out.append(InboundEmail(
                    from_address=parseaddr(msg.get("From", ""))[1].lower(),
                    subject=str(make_header(decode_header(msg.get("Subject", "")))),
                    body=_text_body(msg),
                    message_id=msg.get("Message-ID"),
                    in_reply_to=msg.get("In-Reply-To"),
                ))
                conn.store(num, "+FLAGS", "\\Seen")
        return out
