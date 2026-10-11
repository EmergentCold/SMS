import logging
from datetime import datetime, timedelta

import pytest

from src.compliance import content_guard, permissions
from src.crm import pipeline
from src.integrations import registry
from src.outreach import sender
from src.settings import TZ, clock, redact
from tests.conftest import FakeChannel, make_lead


def _first_message(app):
    make_lead(app)
    sender.plan_first_contacts(app)
    return app.db.scalar("SELECT id FROM messages WHERE kind='first_contact'")


def test_autonomy_levels(app):
    assert permissions.check(app, "score").decision is permissions.Decision.ALLOW
    assert permissions.check(app, "send_first_contact").decision is permissions.Decision.NEEDS_APPROVAL
    assert permissions.check(app, "sign_contract").decision is permissions.Decision.HUMAN_ONLY
    assert permissions.check(app, "acao_inventada").decision is permissions.Decision.NEEDS_APPROVAL
    app.settings.autonomy["actions"]["send_first_contact"]["enabled"] = True
    assert permissions.check(app, "send_first_contact").allowed


def test_human_only_action_is_never_executed_even_if_approved(app):
    ok, _ = permissions.authorize(app, "sign_contract", "contract", 1, "assinar")
    approval = app.db.scalar("SELECT id FROM approvals")
    permissions.decide(app, approval, True)
    ok2, _ = permissions.authorize(app, "sign_contract", "contract", 1, "assinar")
    assert not ok and not ok2


def test_first_contact_waits_for_approval_then_sends(app, monkeypatch):
    monkeypatch.setenv("EXTERNAL_SENDING_ENABLED", "true")
    msg = _first_message(app)
    result = sender.dispatch(app, msg)
    assert result.status == "AGUARDANDO_APROVACAO"
    assert app.db.scalar("SELECT status FROM leads") == pipeline.AGUARDANDO_APROVACAO
    assert app.overrides["email"].sent == []
    sender.dispatch(app, msg)  # repetir não duplica o pedido
    assert app.db.scalar("SELECT COUNT(*) FROM approvals WHERE status='PENDENTE'") == 1
    permissions.decide(app, app.db.scalar("SELECT id FROM approvals"), True)
    assert sender.dispatch(app, msg).status == "ENVIADA"
    assert app.db.scalar("SELECT status FROM leads") == pipeline.CONTATADO


def test_rejected_message_is_cancelled(app, monkeypatch):
    monkeypatch.setenv("EXTERNAL_SENDING_ENABLED", "true")
    msg = _first_message(app)
    sender.dispatch(app, msg)
    permissions.decide(app, app.db.scalar("SELECT id FROM approvals"), False)
    assert sender.dispatch(app, msg).status == "CANCELADA"
    assert app.db.scalar("SELECT status FROM leads") == pipeline.CONTATO_AUTORIZADO
    assert app.overrides["email"].sent == []


def test_no_send_when_external_sending_disabled(app):
    app.settings.autonomy["actions"]["send_first_contact"]["enabled"] = True
    msg = _first_message(app)
    result = sender.dispatch(app, msg)
    assert result.status == "PRONTA" and "EXTERNAL_SENDING_ENABLED" in result.reason
    assert app.overrides["email"].sent == []


def test_no_send_without_valid_integration(sending):
    sending.overrides["email"] = FakeChannel(configured=False)
    msg = _first_message(sending)
    result = sender.dispatch(sending, msg)
    assert result.status == "PENDENTE_INTEGRACAO"
    assert sending.db.scalar("SELECT COUNT(*) FROM pending_integrations WHERE name='fake_email'") == 1
    assert sending.db.scalar("SELECT COUNT(*) FROM messages WHERE status='ENVIADA'") == 0
    assert sending.db.scalar("SELECT status FROM leads") == pipeline.CONTATO_AUTORIZADO


def test_real_smtp_adapter_refuses_without_credentials(sending):
    sending.overrides.pop("email")
    assert registry.email_channel(sending).is_configured() is False
    msg = _first_message(sending)
    assert sender.dispatch(sending, msg).status == "PENDENTE_INTEGRACAO"


def test_kill_switch_blocks_and_releases(sending):
    msg = _first_message(sending)
    permissions.set_kill_switch(sending, True, "teste")
    assert sending.settings.kill_switch_file.exists()
    result = sender.dispatch(sending, msg)
    assert result.status == "PRONTA" and "kill switch" in result.reason
    assert sending.overrides["email"].sent == []
    permissions.set_kill_switch(sending, False)
    assert sender.dispatch(sending, msg).status == "ENVIADA"


def test_kill_switch_env_variable(sending, monkeypatch):
    monkeypatch.setenv("KILL_SWITCH", "1")
    msg = _first_message(sending)
    assert sender.dispatch(sending, msg).status == "PRONTA"


def test_owner_identity_required(sending):
    sending.settings.business["owner"]["name"] = "CONFIGURAR"
    make_lead(sending)
    result = sender.run_outreach(sending)
    assert result["planejamento"]["preparadas"] == 0
    assert sending.db.scalar("SELECT COUNT(*) FROM pending_integrations WHERE name='identidade_remetente'") == 1
    assert sending.overrides["email"].sent == []


def test_outside_business_hours_waits(sending):
    clock.set(datetime(2026, 10, 17, 10, 0, tzinfo=TZ))  # sábado
    msg = _first_message(sending)
    result = sender.dispatch(sending, msg)
    assert result.status == "PRONTA" and "horário" in result.reason


def test_daily_first_contact_limit(sending):
    sending.settings.outreach["limits"]["max_first_contacts_per_day"] = 1
    make_lead(sending, name="A", website="https://a-limite.test", email="contato@a-limite.test")
    make_lead(sending, name="B", website="https://b-limite.test", email="contato@b-limite.test")
    result = sender.run_outreach(sending)
    assert result["envios"].get("ENVIADA") == 1 and result["envios"].get("PRONTA") == 1


def test_dispatch_is_idempotent(sending):
    msg = _first_message(sending)
    assert sender.dispatch(sending, msg).status == "ENVIADA"
    assert sender.dispatch(sending, msg).reason.startswith("já enviada")
    assert len(sending.overrides["email"].sent) == 1


def test_crash_during_send_never_resends(sending):
    msg = _first_message(sending)
    sending.db.execute("UPDATE messages SET status='ENVIANDO', updated_at='2026-10-13T09:00:00-03:00' WHERE id=?",
                       (msg,))
    out = sender.recover_stuck(sending)
    assert out["mensagens_incertas"] == 1
    assert sender.dispatch(sending, msg).status == "INCERTA"
    sender.dispatch_pending(sending)
    assert sending.overrides["email"].sent == []


def test_provider_failure_is_recorded_without_secrets(sending, caplog):
    sending.overrides["email"] = FakeChannel(fail=True)
    msg = _first_message(sending)
    with caplog.at_level(logging.ERROR, logger="sst"):
        result = sender.dispatch(sending, msg)
    assert result.status == "FALHOU"
    assert "supersecreta123" not in result.reason
    assert "supersecreta123" not in sending.db.scalar("SELECT error FROM messages WHERE id=?", (msg,))
    assert all("supersecreta123" not in r.getMessage() for r in caplog.records)


def test_content_guard_blocks_false_claims(app):
    bad = [
        "Nossa auditoria revelou falhas na sua operação. Para descadastrar responda.",
        "Identificamos irregularidades na empresa. descadastrar",
        "Recebi uma indicação do seu gerente. descadastrar",
        "Garantimos conformidade total. descadastrar",
    ]
    for text in bad:
        assert content_guard.violations(app.settings, text), text
    assert content_guard.violations(app.settings, "Mensagem sem opção de saída")
    assert not content_guard.violations(app.settings, "Olá. Posso ajudar? Para descadastrar, responda.")


def test_blocked_content_is_never_sent(sending):
    msg = _first_message(sending)
    sending.db.execute("UPDATE messages SET body = body || ' Nossa auditoria revelou falhas.' WHERE id=?", (msg,))
    assert sender.dispatch(sending, msg).status == "BLOQUEADA"
    assert sending.overrides["email"].sent == []


def test_log_redaction(monkeypatch):
    monkeypatch.setenv("SMTP_PASSWORD", "minha-senha-forte")
    text = redact("login falhou com minha-senha-forte; token=abc123xyz Authorization: Bearer eyJhbGciOi.x.y "
                  "chave sk-ant-api03-ABCDEFGHIJKLMNOP")
    for secret in ("minha-senha-forte", "abc123xyz", "eyJhbGciOi", "sk-ant-api03-ABCDEFGHIJKLMNOP"):
        assert secret not in text


def test_logger_file_output_is_redacted(app, monkeypatch):
    monkeypatch.setenv("SMTP_PASSWORD", "outra-senha-999")
    app.log.error("conexão com senha outra-senha-999 falhou")
    files = [h.baseFilename for h in app.log.handlers if hasattr(h, "baseFilename")]
    assert files
    for handler in app.log.handlers:
        handler.flush()
    for name in files:
        content = open(name, encoding="utf-8").read()
        assert "outra-senha-999" not in content
    assert any("conexão com senha *** falhou" in open(n, encoding="utf-8").read() for n in files)


def test_pipeline_rejects_skipping_stages_and_missing_evidence(app):
    lead_id = make_lead(app, authorize=False)
    with pytest.raises(pipeline.TransitionError):
        pipeline.transition(app, lead_id, pipeline.CONTATADO, evidence_type="mensagem_enviada", evidence_ref=1)
    with pytest.raises(pipeline.TransitionError):
        pipeline.transition(app, lead_id, pipeline.QUALIFICADO, evidence_type="palpite", evidence_ref="x")
    pipeline.transition(app, lead_id, pipeline.QUALIFICADO, evidence_type="score", evidence_ref=70)
    pipeline.transition(app, lead_id, pipeline.CONTATO_AUTORIZADO, evidence_type="base_legal", evidence_ref="c:1")
    with pytest.raises(pipeline.TransitionError):  # mensagem inexistente
        pipeline.transition(app, lead_id, pipeline.CONTATADO, evidence_type="mensagem_enviada", evidence_ref=999)


def test_unsubscribed_lead_never_reopens(app):
    lead_id = make_lead(app, authorize=False)
    pipeline.transition(app, lead_id, pipeline.DESCADASTRADO, evidence_type="optout", evidence_ref="m1")
    for target in (pipeline.QUALIFICADO, pipeline.CONTATADO, pipeline.PESQUISADO):
        with pytest.raises(pipeline.TransitionError):
            pipeline.transition(app, lead_id, target, evidence_type="score", evidence_ref=99)
