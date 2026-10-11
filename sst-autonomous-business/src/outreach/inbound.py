"""Processamento de respostas: intenção, descadastro, cancelamento de follow-ups, CRM e rascunho de resposta."""
from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from dataclasses import dataclass

from ..compliance import lgpd, suppression
from ..crm import pipeline
from ..integrations import registry
from ..integrations.base import NotConfigured
from ..settings import iso
from . import composer, followup, sender

OPTOUT, NEGATIVE, POSITIVE, QUESTION, BOUNCE, NEUTRAL = (
    "DESCADASTRO", "NEGATIVA", "INTERESSE", "PERGUNTA", "ENDERECO_INVALIDO", "NEUTRA")


@dataclass
class Classification:
    intent: str
    faq_id: str | None = None
    faq_answer: str | None = None


def _fold(text: str) -> str:
    text = unicodedata.normalize("NFKD", text or "").lower()
    return "".join(c for c in text if not unicodedata.combining(c))


def _has(text: str, words: list[str]) -> bool:
    folded = _fold(text)
    return any(_fold(w) in folded for w in words)


def _strip_quoted(body: str) -> str:
    """Ignora o histórico citado (linhas com '>' e após 'Em ... escreveu:')."""
    lines = []
    for line in (body or "").splitlines():
        if line.strip().startswith(">"):
            continue
        if _fold(line).strip().startswith(("em ", "on ")) and ("escreveu" in _fold(line) or "wrote" in line):
            break
        if line.strip().startswith("-----Original"):
            break
        lines.append(line)
    return "\n".join(lines)


def classify(settings, from_address: str, subject: str, body: str) -> Classification:
    cfg = settings.outreach
    text = f"{subject}\n{_strip_quoted(body)}"
    if from_address.startswith(("mailer-daemon", "postmaster")) or _has(text, cfg.get("invalid_address_markers", [])):
        return Classification(BOUNCE)
    if _has(text, cfg.get("optout_keywords", [])):
        return Classification(OPTOUT)
    if _has(text, cfg.get("negative_keywords", [])):
        return Classification(NEGATIVE)
    if _has(text, cfg.get("positive_keywords", [])):
        return Classification(POSITIVE)
    for faq in cfg.get("faq", []):
        if _has(text, faq.get("keywords", [])):
            return Classification(QUESTION, faq["id"], faq["answer"])
    if "?" in text:
        return Classification(QUESTION)
    return Classification(NEUTRAL)


def _find_contact(app, from_address: str, in_reply_to: str | None):
    db = app.db
    if in_reply_to:
        row = db.one("SELECT c.* FROM messages m JOIN contacts c ON c.id = m.contact_id "
                     "WHERE m.provider_message_id=?", (in_reply_to.strip(),))
        if row:
            return row
    return db.one("SELECT * FROM contacts WHERE email=?", (suppression.normalize_email(from_address),))


def register_inbound(app, *, from_address: str, subject: str, body: str, message_id: str | None = None,
                     in_reply_to: str | None = None) -> dict:
    db = app.db
    from_address = suppression.normalize_email(from_address)
    key = "in:" + (message_id or hashlib.sha256(f"{from_address}|{subject}|{body}".encode()).hexdigest())
    if db.one("SELECT 1 FROM messages WHERE idempotency_key=?", (key,)):
        return {"status": "duplicada", "idempotency_key": key}
    result = classify(app.settings, from_address, subject, body)
    contact = _find_contact(app, from_address, in_reply_to)
    lead = None
    if contact is not None:
        lead = db.one("SELECT l.* FROM leads l WHERE l.company_id=?", (contact["company_id"],))
    with db.transaction():
        msg_id = db.insert("messages", {
            "lead_id": lead["id"] if lead else None, "contact_id": contact["id"] if contact else None,
            "direction": "IN", "channel": "email", "kind": "inbound", "subject": subject, "body": body,
            "status": "RECEBIDA", "idempotency_key": key, "provider_message_id": message_id,
            "in_reply_to": in_reply_to, "intent": result.intent, "created_at": iso(), "updated_at": iso()})
        db.audit("mensagem_recebida", "messages", msg_id, {"intent": result.intent, "lead": lead["id"] if lead else None})
    outcome = {"message_id": msg_id, "intent": result.intent, "lead_id": lead["id"] if lead else None, "acoes": []}

    # Descadastro vale mesmo para remetente desconhecido.
    if result.intent == OPTOUT:
        lgpd.object_to_processing(app, from_address, "pedido de descadastro por resposta")
        outcome["acoes"].append("supressao")
        if lead:
            followup.cancel_sequence(app, lead["id"], "pedido de descadastro")
            if lead["status"] not in pipeline.TERMINAL:
                pipeline.transition(app, lead["id"], pipeline.DESCADASTRADO, evidence_type="optout",
                                    evidence_ref=msg_id, reason="pediu para não receber contatos")
                outcome["acoes"].append("lead_descadastrado")
        return outcome

    if lead is None:
        _review_task(app, None, msg_id, "mensagem de remetente não vinculado a lead — revisar")
        outcome["acoes"].append("revisao_manual")
        return outcome

    if result.intent == BOUNCE:
        with db.transaction():
            db.execute("UPDATE contacts SET status='INVALIDO', updated_at=? WHERE id=?", (iso(), contact["id"]))
        followup.cancel_sequence(app, lead["id"], "endereço inválido")
        others = db.scalar("SELECT COUNT(*) FROM contacts WHERE company_id=? AND status='ATIVO'", (contact["company_id"],))
        if not others and lead["status"] not in pipeline.TERMINAL:
            pipeline.transition(app, lead["id"], pipeline.BLOQUEADO, evidence_type="endereco_invalido",
                                evidence_ref=msg_id, reason="e-mail retornou como inválido")
        outcome["acoes"].append("contato_invalido")
        return outcome

    followup.cancel_sequence(app, lead["id"], "destinatário respondeu")
    outcome["acoes"].append("followups_cancelados")
    current = db.one("SELECT * FROM leads WHERE id=?", (lead["id"],))
    if current["status"] in (pipeline.CONTATADO, pipeline.QUALIFICADO, pipeline.CONTATO_AUTORIZADO):
        pipeline.transition(app, lead["id"], pipeline.RESPONDEU, evidence_type="mensagem_recebida",
                            evidence_ref=msg_id, reason=f"resposta: {result.intent}")
    elif current["status"] == pipeline.PROPOSTA and result.intent in (POSITIVE, QUESTION, NEUTRAL):
        pipeline.transition(app, lead["id"], pipeline.NEGOCIACAO, evidence_type="mensagem_recebida",
                            evidence_ref=msg_id, reason="retorno sobre a proposta")

    if result.intent == NEGATIVE:
        current = db.one("SELECT status FROM leads WHERE id=?", (lead["id"],))
        if current["status"] not in pipeline.TERMINAL:
            pipeline.transition(app, lead["id"], pipeline.PERDIDO, evidence_type="mensagem_recebida",
                                evidence_ref=msg_id, reason="respondeu sem interesse")
        outcome["acoes"].append("lead_perdido")
        return outcome

    clean_subject = re.sub(r"^(\s*(re|res|enc|fw|fwd)\s*:\s*)+", "", subject or "", flags=re.I) or "contato"
    variables_extra = {"original_subject": clean_subject, "answer": None}
    if result.intent == QUESTION and result.faq_answer:
        lead_view = _lead_dict(app, lead["id"])
        ctx = sender.contact_context(app, contact["id"])
        base = composer.base_variables(app, lead_view, ctx)
        variables_extra["answer"] = composer.render_text(result.faq_answer, base)
        kind, variant = "reply_faq", "faq"
    elif result.intent in (POSITIVE, QUESTION, NEUTRAL):
        kind, variant = "reply", "interesse"
    else:
        return outcome

    with db.transaction():
        db.execute("UPDATE leads SET next_action=?, updated_at=? WHERE id=?",
                   ("responder interessado e propor reunião" if kind == "reply" else "acompanhar resposta da FAQ",
                    iso(), lead["id"]))
    try:
        reply_id, _ = sender.compose_and_create(
            app, lead_id=lead["id"], contact_id=contact["id"], template="reply", variant=variant, kind=kind,
            idempotency_key=f"reply:{msg_id}", extra_vars=variables_extra, in_reply_to=message_id)
    except composer.TemplateError as exc:
        _review_task(app, lead["id"], msg_id, f"resposta não gerada automaticamente: {exc}")
        return outcome
    _maybe_ai_note(app, reply_id, body)
    dispatch = sender.dispatch(app, reply_id)
    outcome["acoes"].append(f"resposta #{reply_id}: {dispatch.status}")
    return outcome


def _lead_dict(app, lead_id: int) -> dict:
    from ..crm import repository
    return repository.lead_view(app, lead_id)


def _review_task(app, lead_id, msg_id, note: str) -> None:
    with app.db.transaction():
        app.db.execute("INSERT OR IGNORE INTO tasks(lead_id, kind, due_at, status, payload, dedupe_key, created_at, "
                       "updated_at) VALUES (?, 'revisao_manual', ?, 'PENDENTE', ?, ?, ?, ?)",
                       (lead_id, iso(), json.dumps({"message_id": msg_id, "nota": note}, ensure_ascii=False),
                        f"review:{msg_id}", iso(), iso()))


def _maybe_ai_note(app, reply_id: int, inbound_body: str) -> None:
    """Se houver IA configurada, anexa uma sugestão de resposta como nota de auditoria (não substitui o modelo)."""
    model = registry.ai(app)
    if not model.is_configured():
        return
    try:
        suggestion = model.complete(
            "Você auxilia um Técnico em Segurança do Trabalho a responder clientes B2B. Responda em português, "
            "em até 120 palavras, sem prometer conformidade, sem citar auditorias não realizadas e sem preços.",
            f"Mensagem recebida:\n{inbound_body[:3000]}\n\nSugira uma resposta.")
        app.db.audit("sugestao_ia", "messages", reply_id, {"sugestao": suggestion[:2000]})
    except NotConfigured:
        return
    except Exception as exc:  # noqa: BLE001
        app.log.warning("IA indisponível: %s", type(exc).__name__)


def poll_inbox(app) -> dict:
    box = registry.inbox(app)
    if not box.is_configured():
        from ..integrations.base import record_pending
        record_pending(app, "email_imap", "leitura de respostas não configurada",
                       "definir IMAP_HOST, IMAP_USER, IMAP_PASSWORD no .env")
        return {"status": "PENDENTE_INTEGRACAO"}
    processed = []
    for item in box.fetch_unseen():
        processed.append(register_inbound(app, from_address=item.from_address, subject=item.subject,
                                          body=item.body, message_id=item.message_id, in_reply_to=item.in_reply_to))
    return {"processadas": len(processed), "detalhes": processed}
