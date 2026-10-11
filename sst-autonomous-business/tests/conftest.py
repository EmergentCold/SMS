from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.app import build_app  # noqa: E402
from src.compliance import lgpd  # noqa: E402
from src.crm import pipeline, repository, scoring  # noqa: E402
from src.integrations.email_smtp import SendResult  # noqa: E402
from src.settings import TZ, clock  # noqa: E402

BUSINESS_TIME = datetime(2026, 10, 13, 10, 0, tzinfo=TZ)  # terça-feira 10h


class FakeChannel:
    """Canal de teste que registra envios. Externo: obedece EXTERNAL_SENDING_ENABLED."""

    name = "fake_email"
    is_external = True

    def __init__(self, configured: bool = True, fail: bool = False) -> None:
        self.configured = configured
        self.fail = fail
        self.sent: list[dict] = []

    def is_configured(self) -> bool:
        return self.configured

    def missing(self) -> list[str]:
        return [] if self.configured else ["SMTP_HOST", "SMTP_PASSWORD"]

    def send(self, **kwargs) -> SendResult:
        if self.fail:
            raise ConnectionError("smtp indisponível password=supersecreta123")
        self.sent.append(kwargs)
        return SendResult(provider_message_id=f"<fake-{len(self.sent)}@test>")


@pytest.fixture
def app(tmp_path, monkeypatch):
    for var in ("EXTERNAL_SENDING_ENABLED", "KILL_SWITCH", "SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM",
                "BRAVE_SEARCH_API_KEY", "ANTHROPIC_API_KEY", "AI_MODEL", "CNPJ_LOOKUP_ENABLED", "SST_DB_PATH"):
        monkeypatch.delenv(var, raising=False)
    monkeypatch.setenv("SST_REPORTS_DIR", str(tmp_path / "reports"))
    application = build_app(ROOT, db_path=tmp_path / "test.db", data_dir=tmp_path / "data")
    application.settings.business["owner"]["name"] = "Fulano de Teste"
    application.settings.business["brand"]["commercial_email"] = "fulano@consultoria.test"
    application.settings.business["brand"]["trade_name"] = "Consultoria Teste"
    application.overrides["email"] = FakeChannel()
    clock.set(BUSINESS_TIME)
    yield application
    clock.set(None)
    application.close()


@pytest.fixture
def sending(app, monkeypatch):
    """Envio externo habilitado e contato inicial liberado no nível 2."""
    monkeypatch.setenv("EXTERNAL_SENDING_ENABLED", "true")
    app.settings.autonomy["actions"]["send_first_contact"]["enabled"] = True
    return app


def make_lead(app, *, name="Transportadora Teste", website="https://transp-teste.test", segment="transportadora",
              city="Guarulhos", size="media", email="contato@transp-teste.test", facts=1,
              contact_type="generic_corporate", authorize=True) -> int:
    source = lgpd.register_source(app, "csv_proprietario", "lista de teste", url=website)
    res = repository.upsert_company(app, name=name, website=website, segment=segment, city=city, state="SP",
                                    size_estimate=size, size_source="teste", source_id=source)
    lead_id = repository.ensure_lead(app, res.company_id)
    if email:
        repository.add_contact(app, res.company_id, email=email, contact_type=contact_type, source_id=source,
                               source_url=website, legal_basis="legitimo_interesse")
    for i in range(facts):
        repository.add_evidence(app, res.company_id, kind="FATO", tag="expansao", statement=f"fato {i}",
                                source_id=source, url=website)
    if authorize:
        scoring.qualify_pending(app)
        status = app.db.scalar("SELECT status FROM leads WHERE id=?", (lead_id,))
        assert status == pipeline.CONTATO_AUTORIZADO, status
    return lead_id
