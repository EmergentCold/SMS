"""Propostas a partir do catálogo (config/services.json) e dos preços aprovados (config/pricing.json).

Regras: sem preço aprovado → PRECO_PENDENTE (não envia). Desconto dentro do limite → ação
'negotiate_discount' (nível 2). Acima do limite ou abaixo do preço mínimo → 'discount_above_limit' (nível 3).
Serviço que exige validação profissional → 'propose_restricted_service' (nível 3).
"""
from __future__ import annotations

from datetime import timedelta

from ..compliance import permissions
from ..crm import pipeline, repository
from ..outreach import composer, sender
from ..settings import iso, now


class ProposalError(ValueError):
    pass


def _money(value: float) -> str:
    text = f"{value:,.2f}"
    return "R$ " + text.replace(",", "X").replace(".", ",").replace("X", ".")


def _bullets(items: list[str]) -> str:
    return "\n".join(f"- {item}" for item in items) if items else "- (não informado)"


def price_status(settings, code: str) -> tuple[bool, dict, str]:
    pricing = settings.pricing.get("services", {}).get(code)
    if pricing is None:
        return False, {}, "serviço sem configuração de preço"
    if pricing.get("status") != "aprovado":
        return False, pricing, "preço pendente: status != 'aprovado' em config/pricing.json"
    if pricing.get("list_price") in (None, "") or pricing.get("min_price") in (None, ""):
        return False, pricing, "preço pendente: list_price/min_price não configurados"
    if float(pricing["min_price"]) > float(pricing["list_price"]):
        return False, pricing, "configuração inválida: min_price maior que list_price"
    return True, pricing, "preço aprovado"


def create_proposal(app, lead_id: int, service_code: str, discount_pct: float = 0.0) -> dict:
    s = app.settings
    db = app.db
    service = s.services["services"].get(service_code)
    if service is None:
        raise ProposalError(f"serviço {service_code} não existe no catálogo")
    if not service.get("available"):
        raise ProposalError(f"serviço {service_code} não está disponível para oferta")
    if not 0 <= discount_pct < 100:
        raise ProposalError("desconto deve estar entre 0 e 100")
    lead = repository.lead_view(app, lead_id)
    if lead["status"] in pipeline.TERMINAL - {pipeline.GANHO}:
        raise ProposalError(f"lead em estado {lead['status']}")

    version = int(db.scalar("SELECT COALESCE(MAX(version),0) FROM proposals WHERE lead_id=? AND service_code=?",
                            (lead_id, service_code))) + 1
    priced, pricing, price_note = price_status(s, service_code)
    defaults = s.pricing.get("defaults", {})
    status = "RASCUNHO"
    notes: list[str] = []
    list_price = final_price = None

    if not priced:
        status = "PRECO_PENDENTE"
        notes.append(price_note)
    else:
        list_price = float(pricing["list_price"])
        final_price = round(list_price * (1 - discount_pct / 100), 2)
        max_disc = float(pricing.get("max_discount_pct", defaults.get("max_auto_discount_pct", 0)) or 0)
        if final_price < float(pricing["min_price"]) or discount_pct > max_disc:
            status = "AGUARDANDO_APROVACAO"
            notes.append("desconto acima do limite ou preço abaixo do mínimo: exige aprovação (nível 3)")
        elif discount_pct > 0:
            status = "AGUARDANDO_APROVACAO"
            notes.append("desconto dentro do limite: ação 'negotiate_discount' (nível 2)")
        else:
            status = "PRONTA"
    if service.get("requires_professional_validation") and status != "PRECO_PENDENTE":
        status = "AGUARDANDO_APROVACAO"
        notes.append("serviço exige confirmação de habilitação e responsabilidade técnica (nível 3)")

    valid_days = int(defaults.get("validity_days", 15))
    valid_until = (now() + timedelta(days=valid_days)).date()
    with db.transaction():
        proposal_id = db.insert("proposals", {
            "lead_id": lead_id, "service_code": service_code, "version": version, "status": status,
            "list_price": list_price, "discount_pct": discount_pct, "final_price": final_price,
            "unit": (pricing or {}).get("unit"), "valid_until": valid_until.isoformat(),
            "created_at": iso(), "updated_at": iso(),
        })
        db.audit("proposta_criada", "proposals", proposal_id, {"status": status, "notas": notes})

    path = _render(app, proposal_id)
    approval_ids = _request_needed_approvals(app, proposal_id, service, discount_pct, list_price, pricing)
    return {"proposal_id": proposal_id, "status": status, "arquivo": str(path), "notas": notes,
            "aprovacoes": approval_ids}


def _request_needed_approvals(app, proposal_id, service, discount_pct, list_price, pricing) -> list[int]:
    ids = []
    row = app.db.one("SELECT * FROM proposals WHERE id=?", (proposal_id,))
    if row["status"] != "AGUARDANDO_APROVACAO":
        return ids
    if service.get("requires_professional_validation"):
        ok, _ = permissions.authorize(app, "propose_restricted_service", "proposal", proposal_id,
                                      f"Confirmar habilitação/responsabilidade para '{service['name']}' (proposta #{proposal_id})")
        if not ok:
            ids.append(_last_approval(app, "propose_restricted_service", proposal_id))
    if list_price is not None and discount_pct > 0:
        below_min = row["final_price"] < float(pricing["min_price"])
        over = discount_pct > float(pricing.get("max_discount_pct", 0) or 0)
        action = "discount_above_limit" if (below_min or over) else "negotiate_discount"
        ok, _ = permissions.authorize(app, action, "proposal", proposal_id,
                                      f"Desconto de {discount_pct:.1f}% na proposta #{proposal_id} "
                                      f"({_money(row['final_price'])})")
        if not ok:
            ids.append(_last_approval(app, action, proposal_id))
    if not ids:
        _set_status(app, proposal_id, "PRONTA")
        _render(app, proposal_id)
    return [i for i in ids if i]


def _last_approval(app, action: str, proposal_id: int) -> int | None:
    return app.db.scalar("SELECT id FROM approvals WHERE action=? AND subject_type='proposal' AND subject_id=? "
                         "ORDER BY id DESC LIMIT 1", (action, proposal_id))


def refresh_approvals(app) -> int:
    """Propostas AGUARDANDO_APROVACAO cujas aprovações foram todas concedidas passam a PRONTA."""
    changed = 0
    for row in app.db.all("SELECT id FROM proposals WHERE status='AGUARDANDO_APROVACAO'"):
        decisions = app.db.all("SELECT status FROM approvals WHERE subject_type='proposal' AND subject_id=?", (row["id"],))
        if decisions and all(d["status"] == "APROVADO" for d in decisions):
            _set_status(app, row["id"], "PRONTA")
            _render(app, row["id"])
            changed += 1
        elif any(d["status"] == "REJEITADO" for d in decisions):
            _set_status(app, row["id"], "RASCUNHO")
    return changed


def _set_status(app, proposal_id: int, status: str) -> None:
    with app.db.transaction():
        app.db.execute("UPDATE proposals SET status=?, updated_at=? WHERE id=?", (status, iso(), proposal_id))


def _render(app, proposal_id: int):
    s = app.settings
    row = app.db.one("SELECT * FROM proposals WHERE id=?", (proposal_id,))
    lead = repository.lead_view(app, row["lead_id"])
    service = s.services["services"][row["service_code"]]
    owner, brand = s.business.get("owner", {}), s.business.get("brand", {})
    defaults = s.pricing.get("defaults", {})
    if row["final_price"] is None:
        price_block = ("**PREÇO PENDENTE** — valor ainda não aprovado pelo proprietário em config/pricing.json. "
                       "Este documento é um rascunho e não pode ser enviado.")
    else:
        price_block = f"Valor: **{_money(row['final_price'])}** por {row['unit']}."
        if row["discount_pct"]:
            price_block += f" (Valor de tabela {_money(row['list_price'])}, desconto de {row['discount_pct']:.1f}%.)"
    validation = ("Recomenda-se visita técnica prévia para confirmar escopo e prazos. " +
                  ("Este serviço exige confirmação de habilitação e responsabilidade técnica pelo profissional "
                   "responsável antes da execução." if service.get("requires_professional_validation") else
                   "Itens que exijam profissional legalmente habilitado ficam fora deste escopo."))
    status_label = {"PRECO_PENDENTE": "RASCUNHO — PREÇO PENDENTE", "AGUARDANDO_APROVACAO": "RASCUNHO — AGUARDANDO APROVAÇÃO",
                    "RASCUNHO": "RASCUNHO", "PRONTA": "Pronta para envio", "ENVIADA": "Enviada",
                    "ACEITA": "Aceita", "RECUSADA": "Recusada", "EXPIRADA": "Expirada"}.get(row["status"], row["status"])
    variables = {
        "proposal_number": f"{row['id']:04d}-v{row['version']}",
        "proposal_status": status_label,
        "issue_date": now().strftime("%d/%m/%Y"),
        "valid_until": "/".join(reversed(row["valid_until"].split("-"))),
        "brand_name": brand.get("trade_name") or "CONFIGURAR",
        "owner_name": owner.get("name") or "CONFIGURAR",
        "owner_title": owner.get("professional_title") or "CONFIGURAR",
        "brand_cnpj_line": f"CNPJ: {brand['cnpj']}" if brand.get("cnpj") else "CNPJ: (não informado)",
        "commercial_email": brand.get("commercial_email") or "CONFIGURAR",
        "company_name": lead["company_name"],
        "company_cnpj_line": f"CNPJ: {lead['cnpj']}" if lead.get("cnpj") else "CNPJ: a informar pela contratante",
        "company_city": f"{lead.get('city') or 'a informar'}/{lead.get('state') or 'SP'}",
        "service_problem": service["problem"],
        "service_name": service["name"],
        "deliverables": _bullets(service["deliverables"]),
        "lead_time_days": service["lead_time_days"],
        "required_inputs": _bullets(service["required_inputs"]),
        "travel_note": defaults.get("visit_travel_note", ""),
        "exclusions": _bullets(service["exclusions"]),
        "professional_requirements": service["professional_requirements"],
        "price_block": price_block,
        "payment_terms": defaults.get("payment_terms") or "a definir",
        "acceptance_criteria": service["acceptance_criteria"],
        "validation_note": validation,
    }
    text = composer.render_text((s.templates_dir / "proposal.md").read_text(encoding="utf-8"), variables)
    folder = s.data_dir / "proposals"
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"proposta-{row['id']:04d}-v{row['version']}-{row['service_code']}.md"
    path.write_text(text, encoding="utf-8")
    with app.db.transaction():
        app.db.execute("UPDATE proposals SET file_path=?, updated_at=? WHERE id=?", (str(path), iso(), proposal_id))
    return path


def queue_send(app, proposal_id: int) -> dict:
    """Prepara o e-mail da proposta. Só propostas PRONTA (preço aprovado e aprovações concedidas)."""
    db = app.db
    refresh_approvals(app)
    row = db.one("SELECT * FROM proposals WHERE id=?", (proposal_id,))
    if row is None:
        raise ProposalError("proposta inexistente")
    if row["status"] != "PRONTA":
        raise ProposalError(f"proposta #{proposal_id} não pode ser enviada (status {row['status']})")
    capacity = app.settings.business.get("capacity", {})
    active = db.scalar("SELECT COUNT(*) FROM contracts WHERE status='ATIVO'")
    if active >= int(capacity.get("max_active_contracts", 0) or 0):
        raise ProposalError("capacidade operacional configurada atingida (business.capacity.max_active_contracts)")
    lead = db.one("SELECT * FROM leads WHERE id=?", (row["lead_id"],))
    if lead["status"] not in (pipeline.RESPONDEU, pipeline.REUNIAO, pipeline.NEGOCIACAO, pipeline.PROPOSTA):
        raise ProposalError(f"proposta só é enviada a quem demonstrou interesse (lead em {lead['status']})")
    contact = repository.primary_contact(app, row["lead_id"])
    if contact is None:
        raise ProposalError("lead sem contato ativo")
    view = repository.lead_view(app, row["lead_id"])
    base = composer.base_variables(app, view, sender.contact_context(app, contact["id"]))
    proposal_text = open(row["file_path"], encoding="utf-8").read()
    service = app.settings.services["services"][row["service_code"]]
    body = (f"{base['greeting']}\n\nConforme solicitado, segue a proposta para {service['name']}.\n\n"
            f"{proposal_text}\n\nFico à disposição para ajustes de escopo.\n\n{base['signature']}\n\n{base['optout_line']}\n")
    message_id, _ = sender.create_outbound(
        app, lead_id=row["lead_id"], contact_id=contact["id"], kind="proposal",
        subject=f"Proposta comercial — {service['name']} — {view['company_name']}", body=body,
        idempotency_key=f"proposal:{proposal_id}:send")
    result = sender.dispatch(app, message_id)
    return {"message_id": message_id, "envio": result.status, "motivo": result.reason}


def mark_sent(app, message_id: int) -> None:
    msg = app.db.one("SELECT * FROM messages WHERE id=?", (message_id,))
    proposal_id = int(msg["idempotency_key"].split(":")[1])
    with app.db.transaction():
        app.db.execute("UPDATE proposals SET status='ENVIADA', sent_at=?, updated_at=? WHERE id=?",
                       (iso(), iso(), proposal_id))
    _render(app, proposal_id)
    lead = app.db.one("SELECT status FROM leads WHERE id=?", (msg["lead_id"],))
    if lead["status"] in (pipeline.RESPONDEU, pipeline.REUNIAO, pipeline.NEGOCIACAO):
        pipeline.transition(app, msg["lead_id"], pipeline.PROPOSTA, evidence_type="proposta_enviada",
                            evidence_ref=proposal_id, reason="proposta enviada")


def set_outcome(app, proposal_id: int, accepted: bool) -> None:
    """Registro feito pelo proprietário (aceite formal recebido ou recusa)."""
    status = "ACEITA" if accepted else "RECUSADA"
    row = app.db.one("SELECT * FROM proposals WHERE id=?", (proposal_id,))
    if row is None or row["status"] not in ("ENVIADA",):
        raise ProposalError("somente propostas ENVIADAS podem ser aceitas/recusadas")
    with app.db.transaction():
        app.db.execute("UPDATE proposals SET status=?, updated_at=? WHERE id=?", (status, iso(), proposal_id))
        app.db.audit("proposta_" + status.lower(), "proposals", proposal_id, actor="proprietario")
    if not accepted:
        lead = app.db.one("SELECT status FROM leads WHERE id=?", (row["lead_id"],))
        if lead["status"] not in pipeline.TERMINAL:
            pipeline.transition(app, row["lead_id"], pipeline.PERDIDO, evidence_type="proposta_recusada",
                                evidence_ref=proposal_id, reason="proposta recusada")


def expire_old(app) -> int:
    today = now().date().isoformat()
    with app.db.transaction():
        cur = app.db.execute("UPDATE proposals SET status='EXPIRADA', updated_at=? WHERE status IN ('ENVIADA','PRONTA') "
                             "AND valid_until < ?", (iso(), today))
    return cur.rowcount
