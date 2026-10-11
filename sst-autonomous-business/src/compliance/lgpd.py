"""LGPD: origem dos dados, direitos do titular (acesso, correção, oposição, eliminação) e retenção."""
from __future__ import annotations

import json
from datetime import timedelta

from ..settings import iso, now
from . import suppression

LEGAL_BASES = {
    "legitimo_interesse": "LGPD art. 7º, IX — contato B2B profissional, com teste de balanceamento documentado e opt-out em toda mensagem",
    "consentimento": "LGPD art. 7º, I — o titular autorizou o contato",
    "solicitacao_titular": "LGPD art. 7º, V — procedimentos preliminares a contrato a pedido do titular",
}


def register_source(app, kind: str, description: str, url: str | None = None,
                    terms_note: str | None = None, purpose: str = "prospeccao_b2b_sst") -> int:
    with app.db.transaction():
        return app.db.insert("data_sources", {
            "kind": kind, "url": url, "description": description, "retrieved_at": iso(),
            "purpose": purpose, "terms_note": terms_note,
        })


def has_valid_basis(app, contact_id: int) -> tuple[bool, str]:
    row = app.db.one("SELECT legal_basis, status, contact_type FROM contacts WHERE id=?", (contact_id,))
    if row is None:
        return False, "contato inexistente"
    if row["status"] != "ATIVO":
        return False, f"contato com status {row['status']}"
    if row["legal_basis"] not in LEGAL_BASES:
        return False, "base legal não registrada"
    revoked = app.db.one("SELECT 1 FROM consents WHERE contact_id=? AND status='REVOGADO'", (contact_id,))
    if revoked:
        return False, "consentimento/legítimo interesse revogado (oposição)"
    return True, LEGAL_BASES[row["legal_basis"]]


def _record_request(app, subject_ref: str, kind: str, notes: str) -> int:
    return app.db.insert("dsr_requests", {"subject_ref": subject_ref, "kind": kind, "status": "ATENDIDA",
                                          "notes": notes, "received_at": iso(), "completed_at": iso()})


def object_to_processing(app, email: str, reason: str = "oposição do titular") -> int:
    """Oposição/descadastro: supressão + bloqueio do contato + cancelamento de tarefas."""
    email = suppression.normalize_email(email)
    db = app.db
    with db.transaction():
        suppression.add_email(app, email, reason)
        affected = 0
        for contact in db.all("SELECT id FROM contacts WHERE email=?", (email,)):
            db.execute("UPDATE contacts SET status='OPOSICAO', updated_at=? WHERE id=?", (iso(), contact["id"]))
            db.insert("consents", {"contact_id": contact["id"], "purpose": "prospeccao_b2b_sst",
                                   "legal_basis": "n/a", "status": "REVOGADO", "evidence": reason,
                                   "recorded_at": iso()})
            cur = db.execute("UPDATE tasks SET status='CANCELADA', result=?, updated_at=? WHERE status='PENDENTE' "
                             "AND json_extract(payload, '$.contact_id') = ?", (reason, iso(), contact["id"]))
            affected += cur.rowcount
            db.execute("UPDATE messages SET status='CANCELADA', updated_at=? WHERE contact_id=? AND direction='OUT' "
                       "AND status IN ('RASCUNHO','AGUARDANDO_APROVACAO','PRONTA','PENDENTE_INTEGRACAO')",
                       (iso(), contact["id"]))
        _record_request(app, suppression.mask_email(email), "oposicao", reason)
        db.audit("lgpd_oposicao", "contacts", None, {"email": suppression.mask_email(email), "tasks_cancelled": affected})
    return affected


def export_subject(app, email: str) -> dict:
    """Direito de acesso: tudo o que existe sobre o e-mail informado."""
    email = suppression.normalize_email(email)
    db = app.db
    contacts = [dict(r) for r in db.all("SELECT * FROM contacts WHERE email=?", (email,))]
    ids = [c["id"] for c in contacts]
    marks = ",".join("?" * len(ids)) or "NULL"
    messages = [dict(r) for r in db.all(f"SELECT id, direction, channel, kind, subject, status, created_at, sent_at "
                                        f"FROM messages WHERE contact_id IN ({marks})", tuple(ids))]
    consents = [dict(r) for r in db.all(f"SELECT * FROM consents WHERE contact_id IN ({marks})", tuple(ids))]
    sources = [dict(r) for r in db.all(
        f"SELECT ds.* FROM data_sources ds JOIN contacts c ON c.source_id = ds.id WHERE c.id IN ({marks})", tuple(ids))]
    suppressed, _ = suppression.is_suppressed(app, email=email)
    with db.transaction():
        _record_request(app, suppression.mask_email(email), "acesso", f"{len(contacts)} contato(s) exportado(s)")
    return {"titular": email, "gerado_em": iso(), "contatos": contacts, "origens": sources,
            "mensagens": messages, "consentimentos": consents, "na_lista_de_supressao": suppressed}


def correct_subject(app, email: str, field: str, value: str) -> int:
    if field not in {"name", "role", "phone"}:
        raise ValueError("campo não permitido para correção")
    with app.db.transaction():
        cur = app.db.execute(f"UPDATE contacts SET {field}=?, updated_at=? WHERE email=?",
                             (value, iso(), suppression.normalize_email(email)))
        _record_request(app, suppression.mask_email(email), "correcao", field)
    return cur.rowcount


def erase_subject(app, email: str) -> int:
    """Eliminação: anonimiza dados pessoais e mantém só o hash na supressão (para não recontatar)."""
    email = suppression.normalize_email(email)
    object_to_processing(app, email, "pedido de eliminação")
    db = app.db
    with db.transaction():
        rows = db.all("SELECT id FROM contacts WHERE email=?", (email,))
        for row in rows:
            db.execute("UPDATE contacts SET name=NULL, role=NULL, phone=NULL, email=NULL, status='ANONIMIZADO', "
                       "updated_at=? WHERE id=?", (iso(), row["id"]))
            db.execute("UPDATE messages SET body='[eliminado a pedido do titular]', subject=NULL, updated_at=? "
                       "WHERE contact_id=?", (iso(), row["id"]))
        _record_request(app, suppression.mask_email(email), "eliminacao", f"{len(rows)} contato(s) anonimizado(s)")
        db.audit("lgpd_eliminacao", "contacts", None, {"email": suppression.mask_email(email), "count": len(rows)})
    return len(rows)


def apply_retention(app) -> dict:
    """Descarta dados pessoais de leads sem resposta/perdidos além do prazo configurado."""
    cfg = app.settings.business.get("retention", {})
    db = app.db
    result = {"contatos_anonimizados": 0, "mensagens_limpas": 0, "auditoria_removida": 0}
    no_reply_cut = iso(now() - timedelta(days=int(cfg.get("lead_without_response_days", 365))))
    lost_cut = iso(now() - timedelta(days=int(cfg.get("lost_lead_days", 365))))
    msg_cut = iso(now() - timedelta(days=int(cfg.get("messages_days", 730))))
    audit_cut = iso(now() - timedelta(days=int(cfg.get("audit_events_days", 1825))))
    with db.transaction():
        stale = db.all(
            "SELECT c.id FROM contacts c JOIN leads l ON l.company_id = c.company_id "
            "WHERE c.status = 'ATIVO' AND c.contact_type = 'named_professional' AND ("
            " (l.status IN ('CONTATADO','QUALIFICADO','PESQUISADO','CONTATO_AUTORIZADO') AND l.updated_at < ?)"
            " OR (l.status IN ('PERDIDO','DESCADASTRADO','BLOQUEADO') AND l.updated_at < ?))",
            (no_reply_cut, lost_cut))
        for row in stale:
            db.execute("UPDATE contacts SET name=NULL, role=NULL, phone=NULL, status='ANONIMIZADO', updated_at=? "
                       "WHERE id=?", (iso(), row["id"]))
        result["contatos_anonimizados"] = len(stale)
        cur = db.execute("UPDATE messages SET body='[removido por retenção]', updated_at=? "
                         "WHERE created_at < ? AND body NOT LIKE '[%'", (iso(), msg_cut))
        result["mensagens_limpas"] = cur.rowcount
        cur = db.execute("DELETE FROM audit_events WHERE at < ?", (audit_cut,))
        result["auditoria_removida"] = cur.rowcount
        db.audit("lgpd_retencao", details=result)
    return result


def lia_template() -> str:
    """Modelo resumido de teste de balanceamento (legítimo interesse)."""
    return json.dumps({
        "finalidade": "Oferecer serviços de consultoria em SST a empresas, por canal comercial profissional.",
        "necessidade": "Somente nome da empresa, canal comercial e, se houver, nome/cargo profissional.",
        "expectativa_do_titular": "Contato comercial B2B pelo canal publicado pela própria empresa.",
        "salvaguardas": ["identificação clara do remetente", "origem do dado informada",
                         "descadastro em toda mensagem", "lista de supressão", "limites de frequência",
                         "retenção limitada", "sem dados sensíveis"],
    }, ensure_ascii=False, indent=2)
