import pytest

from src.analytics import metrics
from src.compliance import permissions
from src.crm import finance, pipeline
from src.outreach import inbound, sender
from src.proposals import generator
from tests.conftest import make_lead


def _interested_lead(app):
    lead_id = make_lead(app)
    sender.run_outreach(app)
    inbound.register_inbound(app, from_address="contato@transp-teste.test", subject="Re", body="Temos interesse.")
    assert app.db.scalar("SELECT status FROM leads WHERE id=?", (lead_id,)) == pipeline.RESPONDEU
    return lead_id


def _approve_price(app, code="A", list_price=1500.0, min_price=1200.0, max_discount=10):
    app.settings.pricing["services"][code].update(status="aprovado", list_price=list_price, min_price=min_price,
                                                  max_discount_pct=max_discount)
    app.settings.pricing["defaults"]["payment_terms"] = "50% no aceite, 50% na entrega"


def test_pending_price_creates_draft_that_cannot_be_sent(sending):
    sending.settings.pricing["services"]["A"].update(status="preco_pendente", list_price=None, min_price=None)
    lead_id = _interested_lead(sending)
    result = generator.create_proposal(sending, lead_id, "A")
    assert result["status"] == "PRECO_PENDENTE"
    text = open(result["arquivo"], encoding="utf-8").read()
    assert "PREÇO PENDENTE" in text and "R$" not in text.split("## 8. Investimento")[1].split("## 9")[0]
    with pytest.raises(generator.ProposalError):
        generator.queue_send(sending, result["proposal_id"])


def test_proposal_uses_configured_scope_and_price(sending):
    _approve_price(sending)
    lead_id = _interested_lead(sending)
    result = generator.create_proposal(sending, lead_id, "A")
    assert result["status"] == "PRONTA"
    text = open(result["arquivo"], encoding="utf-8").read()
    service = sending.settings.services["services"]["A"]
    assert "R$ 1.500,00" in text
    for item in service["deliverables"] + service["exclusions"]:
        assert item in text
    for section in ("Identificação das partes", "Objetivo", "Cronograma", "Premissas", "Exclusões",
                    "Responsabilidades", "Condições de pagamento", "Validade", "Critérios de aceite",
                    "Visita técnica"):
        assert section in text


def test_proposal_send_requires_approval_by_default_then_moves_pipeline(sending):
    _approve_price(sending)
    lead_id = _interested_lead(sending)
    prop = generator.create_proposal(sending, lead_id, "A")
    out = generator.queue_send(sending, prop["proposal_id"])
    assert out["envio"] == "AGUARDANDO_APROVACAO"
    permissions.decide(sending, sending.db.scalar("SELECT id FROM approvals WHERE action='send_proposal'"), True)
    assert sender.dispatch(sending, out["message_id"]).status == "ENVIADA"
    assert sending.db.scalar("SELECT status FROM proposals WHERE id=?", (prop["proposal_id"],)) == "ENVIADA"
    assert sending.db.scalar("SELECT status FROM leads WHERE id=?", (lead_id,)) == pipeline.PROPOSTA


def test_discount_within_limit_needs_level2_and_above_limit_needs_level3(sending):
    _approve_price(sending, max_discount=10)
    lead_id = _interested_lead(sending)
    within = generator.create_proposal(sending, lead_id, "A", discount_pct=5)
    assert within["status"] == "AGUARDANDO_APROVACAO"
    assert sending.db.scalar("SELECT action FROM approvals WHERE subject_id=? AND subject_type='proposal'",
                             (within["proposal_id"],)) == "negotiate_discount"
    above = generator.create_proposal(sending, lead_id, "A", discount_pct=15)
    row = sending.db.one("SELECT action, level FROM approvals WHERE subject_id=? AND subject_type='proposal'",
                         (above["proposal_id"],))
    assert row["action"] == "discount_above_limit" and row["level"] == 3


def test_price_below_minimum_requires_level3(sending):
    _approve_price(sending, list_price=1000.0, min_price=980.0, max_discount=10)
    lead_id = _interested_lead(sending)
    res = generator.create_proposal(sending, lead_id, "A", discount_pct=5)  # 950 < 980
    assert sending.db.scalar("SELECT action FROM approvals WHERE subject_type='proposal' AND subject_id=?",
                             (res["proposal_id"],)) == "discount_above_limit"


def test_approved_discount_becomes_ready(sending):
    _approve_price(sending, max_discount=10)
    sending.settings.autonomy["actions"]["send_proposal"]["enabled"] = True
    lead_id = _interested_lead(sending)
    res = generator.create_proposal(sending, lead_id, "A", discount_pct=5)
    permissions.decide(sending, res["aprovacoes"][0], True)
    assert generator.refresh_approvals(sending) == 1
    assert generator.queue_send(sending, res["proposal_id"])["envio"] == "ENVIADA"


def test_restricted_service_requires_professional_validation(sending):
    _approve_price(sending, code="H")
    lead_id = _interested_lead(sending)
    res = generator.create_proposal(sending, lead_id, "H")
    assert res["status"] == "AGUARDANDO_APROVACAO"
    assert sending.db.scalar("SELECT level FROM approvals WHERE action='propose_restricted_service'") == 3


def test_proposal_only_for_interested_leads(sending):
    _approve_price(sending)
    lead_id = make_lead(sending)
    res = generator.create_proposal(sending, lead_id, "A")
    with pytest.raises(generator.ProposalError):
        generator.queue_send(sending, res["proposal_id"])


def test_contract_requires_owner_confirmation_and_sent_proposal(sending):
    _approve_price(sending)
    sending.settings.autonomy["actions"]["send_proposal"]["enabled"] = True
    lead_id = _interested_lead(sending)
    with pytest.raises(ValueError):
        finance.register_contract(sending, lead_id=lead_id, proposal_id=None, total_value=1500, monthly_value=0,
                                  recurring=False, signed_at="2026-10-20", owner_confirms_signature=True)
    prop = generator.create_proposal(sending, lead_id, "A")
    generator.queue_send(sending, prop["proposal_id"])
    with pytest.raises(ValueError):
        finance.register_contract(sending, lead_id=lead_id, proposal_id=prop["proposal_id"], total_value=1500,
                                  monthly_value=0, recurring=False, signed_at="2026-10-20",
                                  owner_confirms_signature=False)
    cid = finance.register_contract(sending, lead_id=lead_id, proposal_id=prop["proposal_id"], total_value=1500,
                                    monthly_value=500, recurring=True, signed_at="2026-10-20",
                                    owner_confirms_signature=True)
    assert sending.db.scalar("SELECT status FROM leads WHERE id=?", (lead_id,)) == pipeline.GANHO
    assert cid


def test_metrics_separate_potential_proposed_contracted_received(sending):
    _approve_price(sending)
    sending.settings.autonomy["actions"]["send_proposal"]["enabled"] = True
    lead_id = _interested_lead(sending)
    prop = generator.create_proposal(sending, lead_id, "A")
    generator.queue_send(sending, prop["proposal_id"])
    m = metrics.compute(sending)["receita"]
    assert m["2_propostas_emitidas_valor"] == 1500 and m["3_contratada_valor"] == 0 and m["4_recebida_valor"] == 0
    cid = finance.register_contract(sending, lead_id=lead_id, proposal_id=prop["proposal_id"], total_value=1500,
                                    monthly_value=0, recurring=False, signed_at="2026-10-20",
                                    owner_confirms_signature=True)
    finance.add_entry(sending, kind="RECEITA", category="servico", amount=750, status="PREVISTO",
                      contract_id=cid, due_date="2026-11-10")
    m = metrics.compute(sending)["receita"]
    assert m["3_contratada_valor"] == 1500 and m["4_recebida_valor"] == 0 and m["a_receber_previsto"] == 750
    finance.add_entry(sending, kind="RECEITA", category="servico", amount=750, status="REALIZADO",
                      contract_id=cid, paid_at="2026-10-21")
    assert metrics.compute(sending)["receita"]["4_recebida_valor"] == 750
    with pytest.raises(ValueError):
        finance.add_entry(sending, kind="RECEITA", category="x", amount=10, status="REALIZADO")  # sem data
