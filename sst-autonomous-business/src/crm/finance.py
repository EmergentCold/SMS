"""Contratos e lançamentos financeiros — sempre registrados pelo proprietário.

O agente nunca assina contratos nem movimenta dinheiro: estes comandos apenas registram fatos
informados pelo proprietário, separando receita prevista de receita recebida.
"""
from __future__ import annotations

from datetime import date

from ..settings import iso
from . import pipeline


def register_contract(app, *, lead_id: int, proposal_id: int | None, total_value: float, monthly_value: float,
                      recurring: bool, signed_at: str, owner_confirms_signature: bool,
                      start_date: str | None = None, end_date: str | None = None) -> int:
    if not owner_confirms_signature:
        raise ValueError("o proprietário precisa confirmar que o contrato foi assinado pelas partes")
    date.fromisoformat(signed_at[:10])
    db = app.db
    lead = db.one("SELECT status FROM leads WHERE id=?", (lead_id,))
    if lead is None:
        raise ValueError(f"lead #{lead_id} não existe")
    if lead["status"] not in (pipeline.PROPOSTA, pipeline.NEGOCIACAO):
        raise ValueError(f"contrato exige proposta enviada (lead em {lead['status']}); "
                         "registre o envio da proposta antes")
    if proposal_id is not None:
        prop = db.one("SELECT * FROM proposals WHERE id=? AND lead_id=?", (proposal_id, lead_id))
        if prop is None:
            raise ValueError("proposta não pertence ao lead")
    with db.transaction():
        contract_id = db.insert("contracts", {
            "lead_id": lead_id, "proposal_id": proposal_id, "total_value": total_value,
            "monthly_value": monthly_value, "recurring": int(recurring), "signed_at": signed_at,
            "signed_by_owner_confirmed": 1, "start_date": start_date, "end_date": end_date,
            "status": "ATIVO", "created_at": iso()})
        if proposal_id is not None:
            db.execute("UPDATE proposals SET status='ACEITA', updated_at=? WHERE id=? AND status='ENVIADA'",
                       (iso(), proposal_id))
        db.audit("contrato_registrado", "contracts", contract_id, {"lead": lead_id, "total": total_value,
                                                                   "mensal": monthly_value}, actor="proprietario")
        pipeline.transition(app, lead_id, pipeline.GANHO, evidence_type="contrato", evidence_ref=contract_id,
                            reason="contrato assinado (registrado pelo proprietário)")
    return contract_id


def add_entry(app, *, kind: str, category: str, amount: float, status: str, description: str = "",
              contract_id: int | None = None, due_date: str | None = None, paid_at: str | None = None) -> int:
    if kind not in ("RECEITA", "DESPESA"):
        raise ValueError("kind deve ser RECEITA ou DESPESA")
    if status not in ("PREVISTO", "REALIZADO"):
        raise ValueError("status deve ser PREVISTO ou REALIZADO")
    if status == "REALIZADO" and not paid_at:
        raise ValueError("lançamento REALIZADO exige data de pagamento/recebimento")
    if amount <= 0:
        raise ValueError("valor deve ser positivo")
    with app.db.transaction():
        entry_id = app.db.insert("financial_entries", {
            "contract_id": contract_id, "kind": kind, "category": category, "description": description,
            "amount": amount, "status": status, "due_date": due_date, "paid_at": paid_at, "created_at": iso()})
        app.db.audit("lancamento_financeiro", "financial_entries", entry_id,
                      {"kind": kind, "status": status, "valor": amount}, actor="proprietario")
    return entry_id
