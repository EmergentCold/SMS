"""Portão único de envio externo.

Toda mensagem passa por: estado do lead → base legal → supressão → destinatário → filtro de conteúdo →
autonomia/aprovação → kill switch → envio externo habilitado → horário comercial → limites →
canal configurado → reserva idempotente (ENVIANDO) → envio.

Se o processo cair durante o envio, a mensagem fica INCERTA e nunca é reenviada automaticamente.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time, timedelta

from ..compliance import content_guard, lgpd, permissions, suppression
from ..crm import pipeline, repository
from ..integrations import registry
from ..integrations.base import NotConfigured, record_pending
from ..research import dedupe
from ..settings import iso, now, parse_dt, redact
from . import composer

KIND_ACTION = {
    "first_contact": "send_first_contact",
    "followup": "send_followup",
    "reply_faq": "reply_faq",
    "reply": "send_reply",
    "proposal": "send_proposal",
    "meeting": "schedule_meeting",
}
PROSPECTING_KINDS = {"first_contact", "followup"}
SENDABLE = ("RASCUNHO", "AGUARDANDO_APROVACAO", "PRONTA", "PENDENTE_INTEGRACAO", "FALHOU")
MAX_ATTEMPTS = 3
STUCK_AFTER = timedelta(minutes=10)


@dataclass
class DispatchResult:
    message_id: int
    status: str
    reason: str

    @property
    def sent(self) -> bool:
        return self.status == "ENVIADA"


# --------------------------------------------------------------------------- criação
def create_outbound(app, *, lead_id: int, contact_id: int, kind: str, subject: str, body: str,
                    idempotency_key: str, step: int | None = None, campaign_id: int | None = None,
                    in_reply_to: str | None = None, channel: str = "email") -> tuple[int, bool]:
    """Cria a mensagem (RASCUNHO). Mesma chave de idempotência → devolve a existente."""
    db = app.db
    existing = db.one("SELECT id FROM messages WHERE idempotency_key=?", (idempotency_key,))
    if existing:
        return int(existing["id"]), False
    with db.transaction():
        message_id = db.insert("messages", {
            "lead_id": lead_id, "contact_id": contact_id, "campaign_id": campaign_id, "direction": "OUT",
            "channel": channel, "kind": kind, "step": step, "subject": subject, "body": body,
            "status": "RASCUNHO", "idempotency_key": idempotency_key, "in_reply_to": in_reply_to,
            "created_at": iso(), "updated_at": iso(),
        })
        db.audit("mensagem_preparada", "messages", message_id, {"kind": kind, "lead": lead_id})
    return message_id, True


def compose_and_create(app, *, lead_id: int, contact_id: int, template: str, variant: str, kind: str,
                       idempotency_key: str, step: int | None = None, extra_vars: dict | None = None,
                       in_reply_to: str | None = None) -> tuple[int, bool]:
    if not app.settings.owner_identity_configured():
        record_pending(app, "identidade_remetente", "nome/e-mail comercial do proprietário não configurados",
                       "preencher config/business.json (owner.name, brand.commercial_email)")
        raise composer.TemplateError("identidade do remetente não configurada")
    lead = repository.lead_view(app, lead_id)
    contact = contact_context(app, contact_id)
    variables = composer.base_variables(app, lead, contact) | (extra_vars or {})
    rendered = composer.render_message(app.settings.templates_dir, template, variant, variables)
    return create_outbound(app, lead_id=lead_id, contact_id=contact_id, kind=kind, subject=rendered.subject,
                           body=rendered.body, idempotency_key=idempotency_key, step=step, in_reply_to=in_reply_to)


def contact_context(app, contact_id: int) -> dict:
    row = app.db.one("SELECT c.*, ds.description AS source_description FROM contacts c "
                     "LEFT JOIN data_sources ds ON ds.id = c.source_id WHERE c.id=?", (contact_id,))
    return dict(row) if row else {}


# --------------------------------------------------------------------------- regras
def in_business_hours(settings, dt: datetime) -> bool:
    cfg = settings.outreach.get("business_hours", {})
    if dt.weekday() not in cfg.get("weekdays", [0, 1, 2, 3, 4]):
        return False
    start = time.fromisoformat(cfg.get("start", "09:00"))
    end = time.fromisoformat(cfg.get("end", "17:30"))
    return start <= dt.time() <= end


def _rate_limit_reason(app, msg, contact) -> str | None:
    limits = app.settings.outreach.get("limits", {})
    db = app.db
    current = now()
    day_start = iso(current.replace(hour=0, minute=0, second=0, microsecond=0))
    hour_ago = iso(current - timedelta(hours=1))
    sent_today = db.scalar("SELECT COUNT(*) FROM messages WHERE direction='OUT' AND status='ENVIADA' "
                           "AND sent_at >= ?", (day_start,))
    if sent_today >= int(limits.get("max_messages_per_day", 40)):
        return "limite diário de mensagens atingido"
    sent_hour = db.scalar("SELECT COUNT(*) FROM messages WHERE direction='OUT' AND status='ENVIADA' "
                          "AND sent_at >= ?", (hour_ago,))
    if sent_hour >= int(limits.get("max_messages_per_hour", 10)):
        return "limite por hora atingido"
    if msg["kind"] == "first_contact":
        firsts = db.scalar("SELECT COUNT(*) FROM messages WHERE direction='OUT' AND status='ENVIADA' "
                           "AND kind='first_contact' AND sent_at >= ?", (day_start,))
        if firsts >= int(limits.get("max_first_contacts_per_day", 15)):
            return "limite diário de primeiros contatos atingido"
        domain = (contact["email"] or "").split("@")[-1]
        cooldown = iso(current - timedelta(days=int(limits.get("domain_cooldown_days", 30))))
        recent = db.scalar("SELECT COUNT(*) FROM messages m JOIN contacts c ON c.id = m.contact_id "
                           "WHERE m.direction='OUT' AND m.status IN ('ENVIADA','ENVIANDO','INCERTA') "
                           "AND m.kind='first_contact' AND c.email LIKE ? AND m.sent_at >= ? AND m.id != ?",
                           ("%@" + domain, cooldown, msg["id"]))
        if recent:
            return f"domínio {domain} contatado nos últimos {limits.get('domain_cooldown_days', 30)} dias"
        per_company = db.scalar("SELECT COUNT(DISTINCT m.contact_id) FROM messages m JOIN contacts c "
                                "ON c.id = m.contact_id WHERE c.company_id=? AND m.kind='first_contact' "
                                "AND m.direction='OUT' AND m.status IN ('ENVIADA','ENVIANDO','INCERTA') "
                                "AND m.contact_id != ?", (contact["company_id"], contact["id"]))
        if per_company >= int(limits.get("max_contacts_per_company", 1)):
            return "empresa já recebeu contato inicial por outro canal"
    return None


def _lead_state_reason(app, msg, lead) -> str | None:
    status = lead["status"]
    if status in (pipeline.DESCADASTRADO, pipeline.BLOQUEADO, pipeline.PERDIDO, pipeline.GANHO):
        if not (status == pipeline.GANHO and msg["kind"] not in PROSPECTING_KINDS):
            return f"lead em estado {status}"
    effective = lead["prior_status"] if status == pipeline.AGUARDANDO_APROVACAO else status
    if msg["kind"] == "first_contact" and effective != pipeline.CONTATO_AUTORIZADO:
        return f"contato inicial exige CONTATO_AUTORIZADO (atual: {status})"
    if msg["kind"] == "followup" and effective != pipeline.CONTATADO:
        return f"follow-up exige CONTATADO (atual: {status})"
    return None


def _set_status(app, message_id: int, status: str, reason: str | None = None) -> None:
    with app.db.transaction():
        app.db.execute("UPDATE messages SET status=?, error=?, updated_at=? WHERE id=?",
                       (status, reason, iso(), message_id))


def _finish(app, msg_id: int, status: str, reason: str, persist: bool = True) -> DispatchResult:
    if persist:
        _set_status(app, msg_id, status, reason)
    app.log.info("mensagem #%s: %s (%s)", msg_id, status, reason)
    return DispatchResult(msg_id, status, reason)


# --------------------------------------------------------------------------- envio
def dispatch(app, message_id: int) -> DispatchResult:
    db = app.db
    msg = db.one("SELECT * FROM messages WHERE id=?", (message_id,))
    if msg is None or msg["direction"] != "OUT":
        raise ValueError(f"mensagem de saída #{message_id} não existe")
    if msg["status"] == "ENVIADA":
        return DispatchResult(message_id, "ENVIADA", "já enviada (idempotente)")
    if msg["status"] not in SENDABLE:
        return DispatchResult(message_id, msg["status"], "estado não permite envio")
    if msg["status"] == "FALHOU" and msg["attempts"] >= MAX_ATTEMPTS:
        return DispatchResult(message_id, "FALHOU", "tentativas esgotadas; revisar manualmente")

    lead = db.one("SELECT * FROM leads WHERE id=?", (msg["lead_id"],))
    contact = db.one("SELECT * FROM contacts WHERE id=?", (msg["contact_id"],))
    if lead is None or contact is None:
        return _finish(app, message_id, "CANCELADA", "lead/contato inexistente")

    reason = _lead_state_reason(app, msg, lead)
    if reason:
        return _finish(app, message_id, "CANCELADA", reason)

    ok, basis = lgpd.has_valid_basis(app, contact["id"])
    if not ok:
        return _finish(app, message_id, "CANCELADA", f"sem base para contato: {basis}")

    blocked, why = suppression.is_suppressed(app, email=contact["email"], phone=contact["phone"])
    if blocked:
        return _finish(app, message_id, "CANCELADA", why)

    if not dedupe.email_is_valid(contact["email"]):
        return _finish(app, message_id, "BLOQUEADA", "destinatário inválido")

    issues = content_guard.violations(app.settings, f"{msg['subject']}\n{msg['body']}")
    if issues:
        return _finish(app, message_id, "BLOQUEADA", "filtro de conteúdo: " + "; ".join(issues))

    if not app.settings.owner_identity_configured():
        record_pending(app, "identidade_remetente", "nome/e-mail comercial do proprietário não configurados",
                       "preencher config/business.json (owner.name, brand.commercial_email)")
        return _finish(app, message_id, "PRONTA", "identidade do remetente não configurada")

    action = KIND_ACTION.get(msg["kind"], "send_reply")
    allowed, why = permissions.authorize(
        app, action, "message", message_id,
        f"{action}: '{msg['subject']}' para {suppression.mask_email(contact['email'])} (lead #{lead['id']})")
    if not allowed:
        if why == "rejeitado pelo proprietário":
            if msg["kind"] == "first_contact" and lead["status"] == pipeline.AGUARDANDO_APROVACAO:
                pipeline.transition(app, lead["id"], pipeline.CONTATO_AUTORIZADO, evidence_type="decisao_humana",
                                    evidence_ref=f"mensagem:{message_id}", reason="contato inicial rejeitado")
                with db.transaction():
                    db.execute("UPDATE leads SET next_action=? WHERE id=?",
                               ("contato inicial rejeitado pelo proprietário — revisar abordagem", lead["id"]))
            return _finish(app, message_id, "CANCELADA", why)
        if msg["kind"] == "first_contact" and lead["status"] == pipeline.CONTATO_AUTORIZADO:
            approval = db.one("SELECT id FROM approvals WHERE action=? AND subject_type='message' AND subject_id=? "
                              "ORDER BY id DESC LIMIT 1", (action, message_id))
            pipeline.transition(app, lead["id"], pipeline.AGUARDANDO_APROVACAO, evidence_type="aprovacao",
                                evidence_ref=approval["id"], reason="contato inicial aguarda aprovação")
        return _finish(app, message_id, "AGUARDANDO_APROVACAO", why)

    paused, why = permissions.is_paused(app)
    if paused:
        return _finish(app, message_id, "PRONTA", f"kill switch: {why}")

    channel = registry.email_channel(app)
    if getattr(channel, "is_external", True) and not app.settings.external_sending_enabled:
        return _finish(app, message_id, "PRONTA", "envio externo desabilitado (EXTERNAL_SENDING_ENABLED=false)")

    if not in_business_hours(app.settings, now()):
        return _finish(app, message_id, "PRONTA", "fora do horário comercial configurado")

    reason = _rate_limit_reason(app, msg, contact)
    if reason:
        return _finish(app, message_id, "PRONTA", reason)

    if not channel.is_configured():
        missing = getattr(channel, "missing", lambda: [])()
        record_pending(app, getattr(channel, "name", "email"), "canal de e-mail sem credenciais",
                       "definir " + ", ".join(missing) + " no .env" if missing else "configurar canal")
        return _finish(app, message_id, "PENDENTE_INTEGRACAO", "canal de e-mail não configurado")

    # Reserva atômica: só um processo consegue passar a mensagem para ENVIANDO.
    with db.transaction():
        cur = db.execute("UPDATE messages SET status='ENVIANDO', attempts=attempts+1, updated_at=? "
                         "WHERE id=? AND status IN ('RASCUNHO','AGUARDANDO_APROVACAO','PRONTA',"
                         "'PENDENTE_INTEGRACAO','FALHOU')", (iso(), message_id))
    if cur.rowcount != 1:
        return DispatchResult(message_id, "IGNORADA", "outra execução já reservou esta mensagem")

    brand_email = app.settings.business.get("brand", {}).get("commercial_email")
    try:
        result = channel.send(to=contact["email"], subject=msg["subject"], body=msg["body"],
                              unsubscribe_mailto=brand_email, in_reply_to=msg["in_reply_to"],
                              idempotency_key=msg["idempotency_key"])
    except NotConfigured as exc:
        record_pending(app, getattr(channel, "name", "email"), str(exc))
        return _finish(app, message_id, "PENDENTE_INTEGRACAO", str(exc))
    except Exception as exc:  # noqa: BLE001 - qualquer falha do provedor
        error = redact(f"{type(exc).__name__}: {exc}")
        app.log.error("falha ao enviar mensagem #%s: %s", message_id, error)
        return _finish(app, message_id, "FALHOU", error)

    with db.transaction():
        db.execute("UPDATE messages SET status='ENVIADA', sent_at=?, provider_message_id=?, error=NULL, "
                   "updated_at=? WHERE id=?", (iso(), result.provider_message_id, iso(), message_id))
        db.audit("mensagem_enviada", "messages", message_id, {"kind": msg["kind"], "lead": lead["id"],
                                                             "canal": getattr(channel, "name", "email")})
    _after_send(app, message_id)
    return DispatchResult(message_id, "ENVIADA", "enviada")


def _after_send(app, message_id: int) -> None:
    from . import followup  # import tardio para evitar ciclo

    msg = app.db.one("SELECT * FROM messages WHERE id=?", (message_id,))
    lead = app.db.one("SELECT * FROM leads WHERE id=?", (msg["lead_id"],))
    if msg["kind"] == "first_contact":
        pipeline.transition(app, lead["id"], pipeline.CONTATADO, evidence_type="mensagem_enviada",
                            evidence_ref=message_id, reason="contato inicial enviado")
        followup.schedule_sequence(app, lead["id"], msg["contact_id"], start=parse_dt(msg["sent_at"]),
                                   origin_message_id=message_id)
    elif msg["kind"] == "proposal":
        from ..proposals import generator
        generator.mark_sent(app, message_id)
    elif msg["kind"] == "meeting":
        from . import meetings
        meetings.mark_confirmed(app, message_id)


def dispatch_pending(app, limit: int = 100) -> dict:
    rows = app.db.all("SELECT id FROM messages WHERE direction='OUT' AND status IN "
                      "('RASCUNHO','AGUARDANDO_APROVACAO','PRONTA','PENDENTE_INTEGRACAO','FALHOU') "
                      "AND attempts < ? ORDER BY id LIMIT ?", (MAX_ATTEMPTS, limit))
    summary: dict[str, int] = {}
    for row in rows:
        result = dispatch(app, row["id"])
        summary[result.status] = summary.get(result.status, 0) + 1
    return summary


def plan_first_contacts(app) -> dict:
    """Prepara contatos iniciais para leads CONTATO_AUTORIZADO (maior pontuação primeiro)."""
    cap = int(app.settings.outreach["limits"].get("max_first_contacts_per_day", 15)) * 2
    rows = app.db.all("SELECT l.id FROM leads l WHERE l.status='CONTATO_AUTORIZADO' AND NOT EXISTS ("
                      "SELECT 1 FROM messages m WHERE m.lead_id=l.id AND m.kind='first_contact') "
                      "ORDER BY l.score DESC, l.id LIMIT ?", (cap,))
    created, errors = 0, 0
    first = app.settings.outreach["followup_sequence"][0]
    for row in rows:
        contact = repository.primary_contact(app, row["id"])
        if contact is None:
            continue
        try:
            _, new = compose_and_create(app, lead_id=row["id"], contact_id=contact["id"],
                                        template=first["template"], variant=first["variant"],
                                        kind="first_contact", step=0, idempotency_key=f"lead:{row['id']}:seq:0")
            created += int(new)
        except composer.TemplateError as exc:
            errors += 1
            app.log.warning("lead #%s: modelo não renderizado: %s", row["id"], exc)
    return {"preparadas": created, "erros_modelo": errors}


def run_outreach(app) -> dict:
    plan = plan_first_contacts(app)
    return {"planejamento": plan, "envios": dispatch_pending(app)}


def recover_stuck(app) -> dict:
    """Após queda: ENVIANDO antigo vira INCERTA (revisão humana, sem reenvio); tarefas presas voltam a PENDENTE."""
    db = app.db
    cutoff = iso(now() - STUCK_AFTER)
    with db.transaction():
        stuck = db.all("SELECT id FROM messages WHERE status='ENVIANDO' AND updated_at < ?", (cutoff,))
        for row in stuck:
            db.execute("UPDATE messages SET status='INCERTA', error=?, updated_at=? WHERE id=?",
                       ("processo interrompido durante o envio; verificar na caixa de saída antes de reenviar",
                        iso(), row["id"]))
            db.audit("mensagem_incerta", "messages", row["id"])
        tasks = db.execute("UPDATE tasks SET status='PENDENTE', updated_at=? WHERE status='EM_EXECUCAO' "
                           "AND updated_at < ?", (iso(), iso(now() - timedelta(minutes=30))))
    if stuck:
        app.log.error("%s mensagem(ns) em estado INCERTO após interrupção — revisar manualmente", len(stuck))
    return {"mensagens_incertas": len(stuck), "tarefas_retomadas": tasks.rowcount}
