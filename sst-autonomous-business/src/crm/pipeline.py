"""Máquina de estados do pipeline. Nenhuma etapa avança sem evidência da ação correspondente."""
from __future__ import annotations

from ..settings import iso

PESQUISADO = "PESQUISADO"
QUALIFICADO = "QUALIFICADO"
CONTATO_AUTORIZADO = "CONTATO_AUTORIZADO"
CONTATADO = "CONTATADO"
RESPONDEU = "RESPONDEU"
REUNIAO = "REUNIAO"
PROPOSTA = "PROPOSTA"
NEGOCIACAO = "NEGOCIACAO"
GANHO = "GANHO"
PERDIDO = "PERDIDO"
DESCADASTRADO = "DESCADASTRADO"
BLOQUEADO = "BLOQUEADO"
AGUARDANDO_APROVACAO = "AGUARDANDO_APROVACAO"

LABELS = {
    PESQUISADO: "Pesquisado", QUALIFICADO: "Qualificado", CONTATO_AUTORIZADO: "Contato autorizado",
    CONTATADO: "Contatado", RESPONDEU: "Respondeu", REUNIAO: "Reunião", PROPOSTA: "Proposta",
    NEGOCIACAO: "Negociação", GANHO: "Ganho", PERDIDO: "Perdido", DESCADASTRADO: "Descadastrado",
    BLOQUEADO: "Bloqueado", AGUARDANDO_APROVACAO: "Aguardando aprovação",
}

TERMINAL = {GANHO, PERDIDO, DESCADASTRADO, BLOQUEADO}

TRANSITIONS: dict[str, set[str]] = {
    PESQUISADO: {QUALIFICADO},
    QUALIFICADO: {CONTATO_AUTORIZADO, PESQUISADO, AGUARDANDO_APROVACAO, RESPONDEU},
    CONTATO_AUTORIZADO: {CONTATADO, AGUARDANDO_APROVACAO, QUALIFICADO, RESPONDEU},
    CONTATADO: {RESPONDEU},
    RESPONDEU: {REUNIAO, PROPOSTA, AGUARDANDO_APROVACAO},
    REUNIAO: {PROPOSTA, RESPONDEU, AGUARDANDO_APROVACAO},
    PROPOSTA: {NEGOCIACAO, GANHO, AGUARDANDO_APROVACAO},
    NEGOCIACAO: {PROPOSTA, GANHO, AGUARDANDO_APROVACAO},
    GANHO: set(),
    PERDIDO: {QUALIFICADO},          # reabertura exige nova qualificação
    DESCADASTRADO: set(),            # nunca reabre automaticamente
    BLOQUEADO: {QUALIFICADO},        # somente com evidência de desbloqueio humano
    AGUARDANDO_APROVACAO: set(),     # resolvido dinamicamente a partir de prior_status
}

# Estados alcançáveis a partir de qualquer estado não terminal (com motivo/evidência).
ANYTIME = {PERDIDO, DESCADASTRADO, BLOQUEADO}

# Evidência exigida para entrar em cada estado.
REQUIRED_EVIDENCE: dict[str, set[str]] = {
    QUALIFICADO: {"score", "decisao_humana"},
    CONTATO_AUTORIZADO: {"base_legal", "decisao_humana"},
    CONTATADO: {"mensagem_enviada"},
    RESPONDEU: {"mensagem_recebida"},
    REUNIAO: {"reuniao"},
    PROPOSTA: {"proposta_enviada"},
    NEGOCIACAO: {"mensagem_recebida", "reuniao"},
    GANHO: {"contrato"},
    PERDIDO: {"mensagem_recebida", "decisao_humana", "sem_resposta", "proposta_recusada"},
    DESCADASTRADO: {"optout"},
    BLOQUEADO: {"decisao_humana", "endereco_invalido", "conformidade"},
    AGUARDANDO_APROVACAO: {"aprovacao"},
    PESQUISADO: {"score"},
}


class TransitionError(ValueError):
    pass


def allowed_targets(status: str, prior_status: str | None = None) -> set[str]:
    if status == AGUARDANDO_APROVACAO:
        base = set(TRANSITIONS.get(prior_status or QUALIFICADO, set())) | {prior_status or QUALIFICADO}
        base.discard(AGUARDANDO_APROVACAO)
        return base | ANYTIME
    targets = set(TRANSITIONS.get(status, set()))
    if status not in TERMINAL:
        targets |= ANYTIME
    return targets


def transition(app, lead_id: int, to_status: str, *, evidence_type: str, evidence_ref: str | int | None,
               reason: str | None = None) -> bool:
    """Muda o estado do lead se a transição for válida e houver evidência adequada.

    Retorna False (sem erro) se o lead já está no estado de destino (idempotência).
    """
    db = app.db
    lead = db.one("SELECT id, status, prior_status FROM leads WHERE id=?", (lead_id,))
    if lead is None:
        raise TransitionError(f"lead #{lead_id} não existe")
    current = lead["status"]
    if current == to_status:
        return False
    if to_status not in allowed_targets(current, lead["prior_status"]):
        raise TransitionError(f"transição inválida {current} → {to_status} (lead #{lead_id})")
    required = REQUIRED_EVIDENCE.get(to_status, set())
    if required and evidence_type not in required:
        raise TransitionError(f"{to_status} exige evidência {sorted(required)}; recebido '{evidence_type}'")
    if required and evidence_ref in (None, ""):
        raise TransitionError(f"{to_status} exige referência da evidência")
    _verify_evidence(app, lead_id, evidence_type, evidence_ref)

    prior = current if to_status == AGUARDANDO_APROVACAO else None
    with db.transaction():
        db.execute("UPDATE leads SET status=?, prior_status=?, updated_at=? WHERE id=?",
                   (to_status, prior, iso(), lead_id))
        if to_status == CONTATADO:
            db.execute("UPDATE leads SET first_contact_at=COALESCE(first_contact_at, ?) WHERE id=?", (iso(), lead_id))
        if to_status == GANHO:
            db.execute("UPDATE leads SET won_at=? WHERE id=?", (iso(), lead_id))
        if to_status == PERDIDO:
            db.execute("UPDATE leads SET lost_reason=? WHERE id=?", (reason, lead_id))
        db.insert("lead_events", {"lead_id": lead_id, "from_status": current, "to_status": to_status,
                                  "evidence_type": evidence_type, "evidence_ref": str(evidence_ref),
                                  "reason": reason, "created_at": iso()})
        db.audit("pipeline", "leads", lead_id, {"de": current, "para": to_status, "evidencia": evidence_type,
                                                "ref": evidence_ref, "motivo": reason})
    return True


def _verify_evidence(app, lead_id: int, evidence_type: str, ref) -> None:
    """Confere no banco que a evidência citada existe e pertence ao lead."""
    db = app.db
    checks = {
        "mensagem_enviada": ("SELECT 1 FROM messages WHERE id=? AND lead_id=? AND direction='OUT' AND status='ENVIADA'"),
        "mensagem_recebida": ("SELECT 1 FROM messages WHERE id=? AND lead_id=? AND direction='IN'"),
        "reuniao": ("SELECT 1 FROM meetings WHERE id=? AND lead_id=? AND status IN ('CONFIRMADA','REALIZADA','PROPOSTA')"),
        "proposta_enviada": ("SELECT 1 FROM proposals WHERE id=? AND lead_id=? AND status IN ('ENVIADA','ACEITA')"),
        "contrato": ("SELECT 1 FROM contracts WHERE id=? AND lead_id=? AND signed_by_owner_confirmed=1"),
        "aprovacao": ("SELECT 1 FROM approvals WHERE id=? AND ? IS NOT NULL"),
        "proposta_recusada": ("SELECT 1 FROM proposals WHERE id=? AND lead_id=? AND status='RECUSADA'"),
    }
    sql = checks.get(evidence_type)
    if sql is None:
        return  # evidências declarativas (score, base_legal, optout, decisao_humana...) são registradas no evento
    if db.one(sql, (int(ref), lead_id)) is None:
        raise TransitionError(f"evidência '{evidence_type}' #{ref} não encontrada para o lead #{lead_id}")
