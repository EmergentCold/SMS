"""Operações de CRM com deduplicação (CNPJ, domínio, e-mail/telefone de contato)."""
from __future__ import annotations

import json
from dataclasses import dataclass

from ..compliance import suppression
from ..research import dedupe
from ..settings import iso


class DuplicateError(ValueError):
    pass


@dataclass
class UpsertResult:
    company_id: int
    created: bool
    matched_by: str | None = None


def find_company(app, *, cnpj: str | None = None, domain: str | None = None,
                 email: str | None = None, phone: str | None = None) -> tuple[int, str] | None:
    db = app.db
    cnpj = dedupe.normalize_cnpj(cnpj)
    if cnpj:
        row = db.one("SELECT id FROM companies WHERE cnpj=?", (cnpj,))
        if row:
            return int(row["id"]), "cnpj"
    if domain:
        row = db.one("SELECT id FROM companies WHERE domain=?", (domain,))
        if row:
            return int(row["id"]), "dominio"
    if email:
        row = db.one("SELECT company_id FROM contacts WHERE email=?", (suppression.normalize_email(email),))
        if row:
            return int(row["company_id"]), "email"
    if phone:
        row = db.one("SELECT company_id FROM contacts WHERE phone=?", (suppression.normalize_phone(phone),))
        if row:
            return int(row["company_id"]), "telefone"
    return None


def upsert_company(app, *, name: str, website: str | None = None, cnpj: str | None = None,
                   segment: str = "desconhecido", segment_confidence: str = "baixa",
                   city: str | None = None, state: str | None = None, legal_name: str | None = None,
                   size_estimate: str = "desconhecido", size_source: str | None = None,
                   size_confidence: str = "baixa", source_id: int | None = None,
                   contact_email: str | None = None, contact_phone: str | None = None,
                   is_simulation: bool = False) -> UpsertResult:
    """Cria a empresa ou devolve a existente. Só preenche campos vazios (não sobrescreve fatos)."""
    db = app.db
    domain = dedupe.company_domain(website)
    free = set(app.settings.outreach.get("free_email_domains", []))
    if domain in free:
        domain = None
    cnpj_norm = dedupe.normalize_cnpj(cnpj)
    if cnpj and not cnpj_norm:
        app.log.warning("CNPJ inválido descartado para %s", name)
    match = find_company(app, cnpj=cnpj_norm, domain=domain, email=contact_email, phone=contact_phone)
    with db.transaction():
        if match:
            company_id, how = match
            row = db.one("SELECT * FROM companies WHERE id=?", (company_id,))
            updates = {}
            for col, val in (("cnpj", cnpj_norm), ("domain", domain), ("website", website), ("city", city),
                             ("state", state), ("legal_name", legal_name)):
                if val and not row[col]:
                    updates[col] = val
            if segment != "desconhecido" and row["segment"] == "desconhecido":
                updates["segment"], updates["segment_confidence"] = segment, segment_confidence
            if size_estimate != "desconhecido" and row["size_estimate"] == "desconhecido":
                updates.update(size_estimate=size_estimate, size_source=size_source, size_confidence=size_confidence)
            if updates:
                updates["updated_at"] = iso()
                sets = ", ".join(f"{k}=?" for k in updates)
                db.execute(f"UPDATE companies SET {sets} WHERE id=?", (*updates.values(), company_id))
            db.audit("duplicata_mesclada", "companies", company_id, {"por": how, "nome_recebido": name})
            return UpsertResult(company_id, False, how)
        company_id = db.insert("companies", {
            "name": name.strip(), "legal_name": legal_name, "cnpj": cnpj_norm, "domain": domain,
            "website": website, "segment": segment, "segment_confidence": segment_confidence,
            "city": city, "state": state, "size_estimate": size_estimate, "size_source": size_source,
            "size_confidence": size_confidence, "source_id": source_id, "is_simulation": int(is_simulation),
            "created_at": iso(), "updated_at": iso(),
        })
        db.audit("empresa_criada", "companies", company_id, {"nome": name, "dominio": domain})
        return UpsertResult(company_id, True, None)


def add_contact(app, company_id: int, *, email: str | None = None, phone: str | None = None,
                name: str | None = None, role: str | None = None, contact_type: str = "generic_corporate",
                source_id: int | None = None, source_url: str | None = None,
                legal_basis: str | None = None, legal_basis_note: str | None = None) -> int | None:
    """Registra um canal de contato. Exige origem rastreável. Retorna None se for duplicado."""
    if not (source_id or source_url):
        raise ValueError("contato sem origem rastreável não pode ser registrado")
    db = app.db
    email_n = suppression.normalize_email(email) if email else None
    if email_n and not dedupe.email_is_valid(email_n):
        raise ValueError(f"e-mail inválido: {email}")
    phone_n = suppression.normalize_phone(phone) if phone else None
    if email_n and db.one("SELECT 1 FROM contacts WHERE email=?", (email_n,)):
        return None
    if phone_n and not email_n and db.one("SELECT 1 FROM contacts WHERE phone=?", (phone_n,)):
        return None
    if contact_type not in app.settings.outreach.get("allowed_contact_types", []):
        raise ValueError(f"tipo de contato não permitido: {contact_type}")
    with db.transaction():
        contact_id = db.insert("contacts", {
            "company_id": company_id, "name": name, "role": role, "email": email_n, "phone": phone_n,
            "contact_type": contact_type, "source_id": source_id, "source_url": source_url,
            "legal_basis": legal_basis, "legal_basis_note": legal_basis_note, "status": "ATIVO",
            "created_at": iso(), "updated_at": iso(),
        })
        if legal_basis:
            db.insert("consents", {"contact_id": contact_id, "purpose": "prospeccao_b2b_sst",
                                   "legal_basis": legal_basis, "status": "ATIVO",
                                   "evidence": legal_basis_note or source_url, "recorded_at": iso()})
        db.audit("contato_criado", "contacts", contact_id, {"tipo": contact_type,
                                                             "email": suppression.mask_email(email_n or "")})
    return contact_id


def add_evidence(app, company_id: int, *, kind: str, statement: str, source_id: int | None = None,
                 url: str | None = None, excerpt: str | None = None, tag: str | None = None,
                 confidence: str = "media") -> int | None:
    if kind not in ("FATO", "HIPOTESE"):
        raise ValueError("kind deve ser FATO ou HIPOTESE")
    if kind == "FATO" and not (url or source_id):
        raise ValueError("fato sem fonte não pode ser registrado")
    db = app.db
    if db.one("SELECT 1 FROM evidence WHERE company_id=? AND kind=? AND statement=?", (company_id, kind, statement)):
        return None
    with db.transaction():
        return db.insert("evidence", {
            "company_id": company_id, "source_id": source_id, "kind": kind, "tag": tag, "statement": statement,
            "excerpt": (excerpt or "")[:500] or None, "url": url, "confidence": confidence, "collected_at": iso(),
        })


def ensure_lead(app, company_id: int) -> int:
    db = app.db
    row = db.one("SELECT id FROM leads WHERE company_id=?", (company_id,))
    if row:
        return int(row["id"])
    with db.transaction():
        lead_id = db.insert("leads", {"company_id": company_id, "status": "PESQUISADO",
                                      "next_action": "qualificar", "created_at": iso(), "updated_at": iso()})
        db.insert("lead_events", {"lead_id": lead_id, "from_status": None, "to_status": "PESQUISADO",
                                  "evidence_type": "pesquisa", "evidence_ref": str(company_id),
                                  "reason": "registro criado", "created_at": iso()})
    return lead_id


def primary_contact(app, lead_id: int):
    """Melhor canal ativo do lead: canal corporativo genérico antes de contato nominal."""
    return app.db.one(
        "SELECT c.* FROM contacts c JOIN leads l ON l.company_id = c.company_id WHERE l.id=? AND c.status='ATIVO' "
        "AND c.email IS NOT NULL ORDER BY CASE c.contact_type WHEN 'inbound_request' THEN 0 "
        "WHEN 'referral_authorized' THEN 1 WHEN 'generic_corporate' THEN 2 ELSE 3 END, c.id LIMIT 1", (lead_id,))


def lead_view(app, lead_id: int) -> dict:
    db = app.db
    lead = db.one("SELECT l.*, c.name AS company_name, c.segment, c.city, c.state, c.domain, c.website, "
                  "c.size_estimate, c.size_source, c.size_confidence, c.cnpj FROM leads l "
                  "JOIN companies c ON c.id = l.company_id WHERE l.id=?", (lead_id,))
    if lead is None:
        raise ValueError(f"lead #{lead_id} não existe")
    data = dict(lead)
    data["score_breakdown"] = json.loads(lead["score_breakdown"]) if lead["score_breakdown"] else None
    data["services"] = json.loads(lead["services"]) if lead["services"] else []
    data["evidence"] = [dict(r) for r in db.all("SELECT kind, tag, statement, url, collected_at FROM evidence "
                                                "WHERE company_id=? ORDER BY id", (lead["company_id"],))]
    data["contacts"] = [dict(r) for r in db.all("SELECT id, name, role, email, phone, contact_type, source_url, "
                                                "legal_basis, status FROM contacts WHERE company_id=?",
                                                (lead["company_id"],))]
    data["history"] = [dict(r) for r in db.all("SELECT from_status, to_status, evidence_type, evidence_ref, reason, "
                                               "created_at FROM lead_events WHERE lead_id=? ORDER BY id", (lead_id,))]
    return data
