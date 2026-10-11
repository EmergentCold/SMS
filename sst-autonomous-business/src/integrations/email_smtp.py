"""E-mail profissional via SMTP autenticado (provedor do domínio do proprietário).

Variáveis: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, SMTP_SECURITY (starttls|ssl).
"""
from __future__ import annotations

import smtplib
import ssl
import uuid
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import formataddr, make_msgid

from ..settings import env
from .base import IntegrationStatus, NotConfigured


@dataclass
class SendResult:
    provider_message_id: str


class SmtpEmailChannel:
    name = "email_smtp"
    is_external = True

    def __init__(self) -> None:
        self.host = env("SMTP_HOST")
        self.port = int(env("SMTP_PORT", "587"))
        self.user = env("SMTP_USER")
        self.password = env("SMTP_PASSWORD")
        self.sender = env("SMTP_FROM")
        self.sender_name = env("SMTP_FROM_NAME", "")
        self.security = (env("SMTP_SECURITY", "starttls") or "starttls").lower()

    def is_configured(self) -> bool:
        return all([self.host, self.user, self.password, self.sender])

    def missing(self) -> list[str]:
        return [k for k, v in {"SMTP_HOST": self.host, "SMTP_USER": self.user, "SMTP_PASSWORD": self.password,
                               "SMTP_FROM": self.sender}.items() if not v]

    def _connect(self) -> smtplib.SMTP:
        context = ssl.create_default_context()
        if self.security == "ssl":
            server: smtplib.SMTP = smtplib.SMTP_SSL(self.host, self.port, timeout=30, context=context)
        else:
            server = smtplib.SMTP(self.host, self.port, timeout=30)
            server.starttls(context=context)
        server.login(self.user, self.password)
        return server

    def verify(self) -> IntegrationStatus:
        if not self.is_configured():
            return IntegrationStatus(self.name, False, None, "credenciais ausentes",
                                     "definir " + ", ".join(self.missing()) + " no .env")
        try:
            server = self._connect()
            server.noop()
            server.quit()
            return IntegrationStatus(self.name, True, True, f"login SMTP ok em {self.host}:{self.port}")
        except Exception as exc:  # noqa: BLE001 - reportar qualquer falha de conexão
            return IntegrationStatus(self.name, True, False, f"falha ao conectar: {type(exc).__name__}",
                                     "conferir host/porta/usuário/senha de app do provedor")

    def send(self, *, to: str, subject: str, body: str, unsubscribe_mailto: str | None = None,
             in_reply_to: str | None = None, idempotency_key: str | None = None) -> SendResult:
        if not self.is_configured():
            raise NotConfigured("SMTP não configurado: " + ", ".join(self.missing()))
        msg = EmailMessage()
        msg["From"] = formataddr((self.sender_name, self.sender)) if self.sender_name else self.sender
        msg["To"] = to
        msg["Subject"] = subject
        domain = self.sender.split("@", 1)[-1]
        msg["Message-ID"] = make_msgid(idstring=(idempotency_key or uuid.uuid4().hex)[:40].replace(":", "-"),
                                       domain=domain)
        if unsubscribe_mailto:
            msg["List-Unsubscribe"] = f"<mailto:{unsubscribe_mailto}?subject=descadastrar>"
        if in_reply_to:
            msg["In-Reply-To"] = in_reply_to
            msg["References"] = in_reply_to
        msg.set_content(body)
        server = self._connect()
        try:
            server.send_message(msg)
        finally:
            try:
                server.quit()
            except Exception:  # noqa: BLE001
                pass
        return SendResult(provider_message_id=msg["Message-ID"])
