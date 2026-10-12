import json
from datetime import timedelta

import pytest

from src.crm import pipeline
from src.integrations import registry
from src.integrations.power_automate_mail import PowerAutomateMailChannel, check_confirmations
from src.outreach import sender
from src.settings import clock
from tests.conftest import BUSINESS_TIME, make_lead


@pytest.fixture
def pa(sending, monkeypatch, tmp_path):
    ponte = tmp_path / "OneDrive" / "SST-Agent"
    ponte.mkdir(parents=True)
    monkeypatch.setenv("EMAIL_CHANNEL", "power_automate")
    monkeypatch.setenv("POWERPLATFORM_DIR", str(ponte))
    sending.overrides.pop("email")
    return sending, ponte / "envios"


def test_channel_selected_and_message_handed_to_flow(pa):
    app, envios = pa
    assert isinstance(registry.email_channel(app), PowerAutomateMailChannel)
    make_lead(app)
    result = sender.run_outreach(app)
    assert result["envios"] == {"ENVIADA": 1}
    files = list(envios.glob("*.json"))
    assert len(files) == 1
    data = json.loads(files[0].read_text(encoding="utf-8"))
    assert data["para"] == "contato@transp-teste.test" and "descadastrar" in data["corpo_texto"]
    assert "<br>" in data["corpo_html"] and "<script" not in data["corpo_html"]
    assert app.db.scalar("SELECT status FROM leads") == pipeline.CONTATADO


def test_not_configured_without_bridge_folder(sending, monkeypatch):
    monkeypatch.setenv("EMAIL_CHANNEL", "power_automate")
    sending.overrides.pop("email")
    make_lead(sending)
    assert sender.run_outreach(sending)["envios"] == {"PENDENTE_INTEGRACAO": 1}


def test_confirmation_and_timeout(pa):
    app, envios = pa
    make_lead(app)
    sender.run_outreach(app)
    key = json.loads(next(envios.glob("*.json")).read_text(encoding="utf-8"))["chave"]
    (envios / "confirmados").mkdir()
    (envios / "confirmados" / f"{key}.json").write_text("{}", encoding="utf-8")
    assert check_confirmations(app)["confirmadas"] == 1
    assert check_confirmations(app)["confirmadas"] == 0  # não conta duas vezes
    assert app.db.scalar("SELECT status FROM messages WHERE direction='OUT'") == "ENVIADA"


def test_missing_confirmation_becomes_uncertain_never_resent(pa):
    app, envios = pa
    make_lead(app)
    sender.run_outreach(app)
    clock.set(BUSINESS_TIME + timedelta(hours=3))
    assert check_confirmations(app)["incertas"] == 1
    assert app.db.scalar("SELECT status FROM messages WHERE direction='OUT'") == "INCERTA"
    sender.dispatch_pending(app)
    assert len(list(envios.glob("*.json"))) == 1


def test_flow_failure_marks_uncertain(pa):
    app, envios = pa
    make_lead(app)
    sender.run_outreach(app)
    key = next(envios.glob("*.json")).stem
    (envios / "falhas").mkdir()
    (envios / "falhas" / f"{key}.json").write_text("{}", encoding="utf-8")
    assert check_confirmations(app)["falhas_do_fluxo"] == 1
