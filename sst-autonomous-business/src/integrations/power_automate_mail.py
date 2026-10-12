"""Canal de e-mail via Power Automate (conector Outlook do Microsoft 365, licença padrão).

O agente grava cada mensagem aprovada em `<POWERPLATFORM_DIR>/envios/<chave>.json`; o fluxo
"SST – Enviar e-mails" envia pelo Outlook (autenticação OAuth gerenciada pela Microsoft — não depende do
SMTP com senha, que o Microsoft 365 desliga por padrão a partir de dez/2026) e grava a confirmação em
`envios/confirmados/<chave>.json`.

A mensagem é marcada ENVIADA ao ser entregue ao fluxo (como um servidor SMTP que aceitou a mensagem).
Sem confirmação dentro do prazo, `check_confirmations` a marca como INCERTA e gera alerta — nunca reenvia.
Ativar com EMAIL_CHANNEL=power_automate no .env.
"""
from __future__ import annotations

import json
import os
import re
from datetime import timedelta
from pathlib import Path

from ..settings import env, iso, now, parse_dt
from .base import IntegrationStatus, NotConfigured
from .email_smtp import SendResult

CONFIRM_TIMEOUT = timedelta(hours=2)
SAFE = re.compile(r"[^A-Za-z0-9_\-]")


def _folder(app=None) -> Path | None:
    base = env("POWERPLATFORM_DIR")
    return Path(base) / "envios" if base else None


class PowerAutomateMailChannel:
    name = "email_power_automate"
    is_external = True

    def __init__(self) -> None:
        self.folder = _folder()
        self.sender = env("SMTP_FROM") or env("EMAIL_FROM")

    def is_configured(self) -> bool:
        return self.folder is not None and self.folder.parent.exists()

    def missing(self) -> list[str]:
        if self.folder is None:
            return ["POWERPLATFORM_DIR"]
        if not self.folder.parent.exists():
            return [f"pasta {self.folder.parent} (OneDrive sincronizado)"]
        return []

    def verify(self) -> IntegrationStatus:
        if not self.is_configured():
            return IntegrationStatus(self.name, False, None, "pasta da ponte ausente",
                                     "definir POWERPLATFORM_DIR e criar o fluxo 'SST – Enviar e-mails'")
        confirmed = len(list((self.folder / "confirmados").glob("*.json"))) if (self.folder / "confirmados").exists() else 0
        return IntegrationStatus(self.name, True, None,
                                 f"entrega via {self.folder}; {confirmed} envio(s) já confirmados pelo fluxo",
                                 None if confirmed else "envie 1 mensagem de teste para validar o fluxo")

    def send(self, *, to: str, subject: str, body: str, unsubscribe_mailto: str | None = None,
             in_reply_to: str | None = None, idempotency_key: str | None = None) -> SendResult:
        if not self.is_configured():
            raise NotConfigured("canal Power Automate sem pasta: " + ", ".join(self.missing()))
        key = SAFE.sub("_", idempotency_key or iso())
        self.folder.mkdir(parents=True, exist_ok=True)
        target = self.folder / f"{key}.json"
        if target.exists() or (self.folder / "confirmados" / f"{key}.json").exists():
            return SendResult(provider_message_id=f"power-automate:{key}")  # já entregue: idempotente
        payload = {"chave": key, "para": to, "assunto": subject, "corpo_texto": body,
                   "corpo_html": body.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                   .replace("\n", "<br>"),
                   "em_resposta_a": in_reply_to, "descadastro": unsubscribe_mailto, "entregue_em": iso()}
        tmp = target.with_suffix(".tmp")
        tmp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, target)
        return SendResult(provider_message_id=f"power-automate:{key}")


def check_confirmations(app) -> dict:
    """Confere confirmações do fluxo; entregas sem confirmação após 2 h viram INCERTA (revisão humana)."""
    folder = _folder(app)
    stats = {"confirmadas": 0, "incertas": 0, "falhas_do_fluxo": 0}
    if folder is None:
        return stats
    confirmed = {p.stem for p in (folder / "confirmados").glob("*.json")} if (folder / "confirmados").exists() else set()
    failed = {p.stem for p in (folder / "falhas").glob("*.json")} if (folder / "falhas").exists() else set()
    db = app.db
    rows = db.all("SELECT id, provider_message_id, sent_at FROM messages WHERE status='ENVIADA' "
                  "AND provider_message_id LIKE 'power-automate:%'")
    for row in rows:
        key = row["provider_message_id"].split(":", 1)[1]
        marker = f"pa_confirmed:{key}"
        if db.get_meta(marker):
            continue
        if key in confirmed:
            with db.transaction():
                db.set_meta(marker, iso())
                db.audit("entrega_confirmada_power_automate", "messages", row["id"])
            stats["confirmadas"] += 1
        elif key in failed or now() - parse_dt(row["sent_at"]) > CONFIRM_TIMEOUT:
            reason = ("o fluxo do Power Automate registrou falha no envio" if key in failed else
                      "sem confirmação do Power Automate em 2 h; verificar o histórico do fluxo antes de reenviar")
            with db.transaction():
                db.execute("UPDATE messages SET status='INCERTA', error=?, updated_at=? WHERE id=?",
                           (reason, iso(), row["id"]))
                db.audit("entrega_incerta_power_automate", "messages", row["id"], {"motivo": reason})
            app.log.error("mensagem #%s: %s", row["id"], reason)
            stats["falhas_do_fluxo" if key in failed else "incertas"] += 1
    return stats
