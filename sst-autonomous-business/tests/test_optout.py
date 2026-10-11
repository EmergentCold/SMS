from datetime import timedelta

from src.compliance import lgpd, suppression
from src.crm import pipeline
from src.outreach import followup, inbound, sender
from src.settings import clock
from tests.conftest import BUSINESS_TIME, make_lead


def _contact_and_sequence(app):
    lead_id = make_lead(app)
    result = sender.run_outreach(app)
    assert result["envios"] == {"ENVIADA": 1}, result
    return lead_id


def _pending_followups(app, lead_id):
    return app.db.scalar("SELECT COUNT(*) FROM tasks WHERE lead_id=? AND kind='followup' AND status='PENDENTE'",
                         (lead_id,))


def test_first_contact_schedules_configured_sequence(sending):
    lead_id = _contact_and_sequence(sending)
    assert sending.db.scalar("SELECT status FROM leads WHERE id=?", (lead_id,)) == pipeline.CONTATADO
    dues = [r["due_at"][:10] for r in sending.db.all(
        "SELECT due_at FROM tasks WHERE lead_id=? AND kind='followup' ORDER BY due_at", (lead_id,))]
    assert dues == ["2026-10-16", "2026-10-20", "2026-10-27"]  # dia 3, 7 e 14


def test_reply_cancels_followups_and_moves_pipeline(sending):
    lead_id = _contact_and_sequence(sending)
    out = inbound.register_inbound(sending, from_address="contato@transp-teste.test", subject="Re: Apoio",
                                   body="Temos interesse, podemos conversar?")
    assert out["intent"] == inbound.POSITIVE
    assert _pending_followups(sending, lead_id) == 0
    assert sending.db.scalar("SELECT status FROM leads WHERE id=?", (lead_id,)) == pipeline.RESPONDEU
    clock.set(BUSINESS_TIME + timedelta(days=4))
    followup.run_due(sending)
    kinds = [r["kind"] for r in sending.db.all("SELECT kind FROM messages WHERE direction='OUT' AND status='ENVIADA'")]
    assert "followup" not in kinds


def test_optout_reply_suppresses_and_stops_everything(sending):
    lead_id = _contact_and_sequence(sending)
    channel = sending.overrides["email"]
    out = inbound.register_inbound(sending, from_address="contato@transp-teste.test", subject="Re: Apoio",
                                   body="Por favor, descadastrar este e-mail.")
    assert out["intent"] == inbound.OPTOUT
    assert sending.db.scalar("SELECT status FROM leads WHERE id=?", (lead_id,)) == pipeline.DESCADASTRADO
    assert suppression.is_suppressed(sending, email="contato@transp-teste.test")[0]
    assert _pending_followups(sending, lead_id) == 0
    sent_before = len(channel.sent)
    clock.set(BUSINESS_TIME + timedelta(days=20))
    followup.run_due(sending)
    sender.dispatch_pending(sending)
    assert len(channel.sent) == sent_before


def test_optout_from_unknown_sender_is_still_honored(app):
    out = inbound.register_inbound(app, from_address="Alguem@Desconhecida.test", subject="x",
                                   body="Não quero receber mensagens. Remova meu e-mail.")
    assert out["intent"] == inbound.OPTOUT
    assert suppression.is_suppressed(app, email="alguem@desconhecida.test")[0]


def test_negative_reply_marks_lost(sending):
    lead_id = _contact_and_sequence(sending)
    inbound.register_inbound(sending, from_address="contato@transp-teste.test", subject="Re",
                             body="Obrigado, mas não temos interesse no momento.")
    assert sending.db.scalar("SELECT status FROM leads WHERE id=?", (lead_id,)) == pipeline.PERDIDO
    assert _pending_followups(sending, lead_id) == 0


def test_bounce_invalidates_contact_and_blocks_lead(sending):
    lead_id = _contact_and_sequence(sending)
    inbound.register_inbound(sending, from_address="mailer-daemon@mx.test", subject="Undeliverable",
                             body="User unknown: contato@transp-teste.test")
    # remetente desconhecido: vai para revisão manual, sem afetar o lead
    assert sending.db.scalar("SELECT COUNT(*) FROM tasks WHERE kind='revisao_manual'") == 1
    inbound.register_inbound(sending, from_address="contato@transp-teste.test", subject="Delivery Status Notification (Failure)",
                             body="address rejected")
    assert sending.db.scalar("SELECT status FROM contacts") == "INVALIDO"
    assert sending.db.scalar("SELECT status FROM leads WHERE id=?", (lead_id,)) == pipeline.BLOQUEADO
    assert _pending_followups(sending, lead_id) == 0


def test_followup_skipped_when_reply_arrives_before_due(sending):
    lead_id = _contact_and_sequence(sending)
    # resposta registrada diretamente (ex.: importada) sem passar pelo cancelamento
    sending.db.insert("messages", {"lead_id": lead_id, "contact_id": 1, "direction": "IN", "channel": "email",
                                   "kind": "inbound", "status": "RECEBIDA", "idempotency_key": "in:x",
                                   "created_at": "2026-10-14T10:00:00-03:00", "updated_at": "2026-10-14T10:00:00-03:00"})
    clock.set(BUSINESS_TIME + timedelta(days=3, hours=1))
    stats = followup.run_due(sending)
    assert stats["cancelados"] == 1 and stats["enviados"] == 0


def test_duplicate_inbound_is_ignored(sending):
    _contact_and_sequence(sending)
    a = inbound.register_inbound(sending, from_address="contato@transp-teste.test", subject="Re", body="ok?",
                                 message_id="<abc@x>")
    b = inbound.register_inbound(sending, from_address="contato@transp-teste.test", subject="Re", body="ok?",
                                 message_id="<abc@x>")
    assert b["status"] == "duplicada" and a["message_id"]


def test_lgpd_erasure_keeps_only_suppression_hash(sending):
    _contact_and_sequence(sending)
    exported = lgpd.export_subject(sending, "contato@transp-teste.test")
    assert exported["contatos"] and exported["mensagens"]
    lgpd.erase_subject(sending, "contato@transp-teste.test")
    assert sending.db.scalar("SELECT COUNT(*) FROM contacts WHERE email='contato@transp-teste.test'") == 0
    assert sending.db.scalar("SELECT display FROM suppression") == "co***@transp-teste.test"
    assert suppression.is_suppressed(sending, email="contato@transp-teste.test")[0]
    raw = sending.db.scalar("SELECT value_hash FROM suppression")
    assert "@" not in raw


def test_domain_suppression_blocks_send(sending):
    make_lead(sending)
    suppression.add_domain(sending, "transp-teste.test", "pedido da empresa")
    result = sender.run_outreach(sending)
    assert "ENVIADA" not in result["envios"]
    assert sending.overrides["email"].sent == []
