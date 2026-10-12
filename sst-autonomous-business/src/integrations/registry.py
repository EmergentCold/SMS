"""Resolve adaptadores (com substituição em testes/simulação) e verifica o estado de cada integração."""
from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path

from ..settings import env, iso
from .base import IntegrationStatus
from .calendar import ExternalCalendar
from .email_imap import ImapInbox
from .email_smtp import SendResult, SmtpEmailChannel
from .providers import AnthropicModel, B2BProvider, BraveSearch, BrasilApiCnpj, ExternalCrm


class SimulationChannel:
    """Canal da simulação: grava a mensagem em arquivo local. Nunca acessa a rede."""

    name = "simulacao_local"
    is_external = False

    def __init__(self, outbox: Path) -> None:
        self.outbox = outbox

    def is_configured(self) -> bool:
        return True

    def send(self, *, to: str, subject: str, body: str, idempotency_key: str | None = None, **_) -> SendResult:
        self.outbox.mkdir(parents=True, exist_ok=True)
        name = (idempotency_key or iso()).replace(":", "_").replace("/", "_")
        (self.outbox / f"{name}.json").write_text(json.dumps(
            {"to": to, "subject": subject, "body": body, "at": iso(), "SIMULACAO": True},
            ensure_ascii=False, indent=2), encoding="utf-8")
        return SendResult(provider_message_id=f"simulacao:{name}")


def email_channel(app):
    if "email" in app.overrides:
        return app.overrides["email"]
    if app.settings.simulation:
        return SimulationChannel(app.settings.data_dir / "simulation_outbox")
    if (env("EMAIL_CHANNEL") or "smtp").lower() == "power_automate":
        from .power_automate_mail import PowerAutomateMailChannel
        return PowerAutomateMailChannel()
    return SmtpEmailChannel()


def inbox(app):
    return app.overrides.get("inbox") or ImapInbox()


def search(app):
    return app.overrides.get("search") or BraveSearch()


def cnpj(app):
    return app.overrides.get("cnpj") or BrasilApiCnpj()


def fetcher(app):
    if "fetcher" in app.overrides:
        return app.overrides["fetcher"]
    from .web import PoliteFetcher
    cfg = app.settings.research
    return PoliteFetcher(cfg["user_agent"], cfg.get("request_delay_seconds", 2.0), cfg.get("timeout_seconds", 15))


def ai(app):
    return app.overrides.get("ai") or AnthropicModel()


def check_all(app, network: bool = True) -> list[IntegrationStatus]:
    """network=False só verifica configuração (sem conexões)."""
    from .power_automate_mail import PowerAutomateMailChannel
    adapters = [SmtpEmailChannel(), PowerAutomateMailChannel(), ImapInbox(), BraveSearch(), BrasilApiCnpj(), B2BProvider(), ExternalCrm(),
                ExternalCalendar(), AnthropicModel()]
    results: list[IntegrationStatus] = []
    for adapter in adapters:
        if network:
            results.append(adapter.verify())
        else:
            ok = adapter.is_configured()
            results.append(IntegrationStatus(adapter.name, ok, None, "configurado (não testado)" if ok else
                                             "não configurado"))
    s = app.settings
    results.append(IntegrationStatus("banco_sqlite", True, True, f"{s.db_path}"))
    results.append(IntegrationStatus("armazenamento_propostas", True, True, f"{s.data_dir / 'proposals'}"))
    results.append(IntegrationStatus("agendador", True, True, "agendador persistente interno (config/schedule.json)"))
    results.append(IntegrationStatus(
        "identidade_remetente", s.owner_identity_configured(), None,
        "ok" if s.owner_identity_configured() else "nome do proprietário/e-mail comercial não configurados",
        None if s.owner_identity_configured() else "preencher owner.name e brand.commercial_email em config/business.json"))
    results.append(IntegrationStatus(
        "envio_externo", s.external_sending_enabled, None,
        "habilitado" if s.external_sending_enabled else "desabilitado (EXTERNAL_SENDING_ENABLED=false)",
        None if s.external_sending_enabled else "habilitar somente após testes e revisão das configurações"))
    return results


def as_dicts(statuses: list[IntegrationStatus]) -> list[dict]:
    return [asdict(s) for s in statuses]
