"""Motor de qualificação (0–100).

A pontuação mede potencial comercial; não comprova infração nem necessidade técnica.
Apenas FATOS com fonte contam como evidência de demanda; hipóteses não pontuam.
"""
from __future__ import annotations

import json
import unicodedata
from dataclasses import dataclass, field

from ..compliance import suppression
from ..settings import iso
from . import pipeline

MAX = {"setor": 25, "recorrencia": 20, "demanda": 20, "competencias": 15, "canal": 10, "geografia": 10}
DEMAND_POINTS_PER_FACT = 7
CHANNEL_POINTS = {"inbound_request": 10, "referral_authorized": 10, "generic_corporate": 10,
                  "named_professional": 8, "phone_only": 5, None: 0}


@dataclass
class ScoreInput:
    segment: str = "desconhecido"
    size: str = "desconhecido"
    demand_facts: int = 0
    best_channel: str | None = None
    channel_suppressed: bool = False
    city: str | None = None
    state: str | None = None


@dataclass
class ScoreResult:
    total: int
    breakdown: dict
    priority: str
    services: list[str]
    notes: list[str] = field(default_factory=list)


def _fold(text: str | None) -> str:
    text = unicodedata.normalize("NFKD", text or "")
    return "".join(c for c in text if not unicodedata.combining(c)).strip().lower()


def classify(total: int) -> str:
    if total >= 80:
        return "alta"
    if total >= 60:
        return "media"
    if total >= 40:
        return "pesquisa_adicional"
    return "observacao"


def compute_score(settings, data: ScoreInput) -> ScoreResult:
    segments = settings.services["segments"]
    seg = segments.get(data.segment) or segments["desconhecido"]
    catalog = settings.services["services"]
    notes: list[str] = []

    setor = min(MAX["setor"], int(seg.get("fit", 0)))

    adjust = settings.services.get("size_recurring_adjust", {}).get(data.size, 0)
    recorrencia = max(0, min(MAX["recorrencia"], int(seg.get("recurring", 0)) + int(adjust)))

    demanda = min(MAX["demanda"], max(0, data.demand_facts) * DEMAND_POINTS_PER_FACT)
    if data.demand_facts == 0:
        notes.append("sem fato público de demanda registrado")

    services = list(seg.get("services", []))
    offerable = [s for s in services if catalog.get(s, {}).get("available")
                 and not catalog.get(s, {}).get("requires_professional_validation")]
    competencias = round(MAX["competencias"] * len(offerable) / len(services)) if services else 0

    canal = 0 if data.channel_suppressed else CHANNEL_POINTS.get(data.best_channel, 0)
    if data.channel_suppressed:
        notes.append("canal na lista de supressão")
    elif data.best_channel is None:
        notes.append("sem canal comercial legítimo")

    area = settings.business.get("service_area", {})
    city = _fold(data.city)
    in_area = False
    if city and city in {_fold(c) for c in area.get("priority_cities", [])}:
        geografia, in_area = 10, True
    elif city and city in {_fold(c) for c in area.get("metro_cities", [])}:
        geografia, in_area = 8, True
    elif _fold(data.state) == _fold(area.get("state")):
        geografia = 5
    elif data.state:
        geografia = 2
    else:
        geografia = 0
    if not in_area and area.get("remote_national"):
        # Fora da área presencial: só serviços remotos/híbridos são ofertáveis; a distância pesa menos.
        remote = [c for c in offerable if catalog.get(c, {}).get("delivery") in ("remoto", "hibrido")]
        if remote:
            offerable = remote
            geografia = max(geografia, 6)
            notes.append("fora da área presencial: ofertar apenas serviços remotos/híbridos")

    breakdown = {"setor": setor, "recorrencia": recorrencia, "demanda": demanda,
                 "competencias": competencias, "canal": canal, "geografia": geografia}
    for key, value in breakdown.items():
        assert 0 <= value <= MAX[key], (key, value)
    total = sum(breakdown.values())
    return ScoreResult(total=total, breakdown=breakdown, priority=classify(total), services=offerable or services,
                       notes=notes)


def build_input(app, lead_id: int) -> ScoreInput:
    db = app.db
    row = db.one("SELECT c.* FROM leads l JOIN companies c ON c.id = l.company_id WHERE l.id=?", (lead_id,))
    demand_tags = set(app.settings.research.get("demand_signals", {}).keys())
    facts = db.all("SELECT tag FROM evidence WHERE company_id=? AND kind='FATO' AND tag IS NOT NULL", (row["id"],))
    demand = sum(1 for f in facts if f["tag"] in demand_tags or f["tag"].startswith("demanda"))
    contacts = db.all("SELECT * FROM contacts WHERE company_id=? AND status='ATIVO'", (row["id"],))
    best, suppressed_all = None, bool(contacts)
    order = ["inbound_request", "referral_authorized", "generic_corporate", "named_professional"]
    for ctype in order:
        for c in contacts:
            if c["contact_type"] != ctype or not c["email"]:
                continue
            blocked, _ = suppression.is_suppressed(app, email=c["email"])
            if not blocked:
                best, suppressed_all = ctype, False
                break
        if best:
            break
    if best is None and any(c["phone"] for c in contacts):
        best, suppressed_all = "phone_only", False
    return ScoreInput(segment=row["segment"], size=row["size_estimate"], demand_facts=demand,
                      best_channel=best, channel_suppressed=suppressed_all and best is None,
                      city=row["city"], state=row["state"])


def score_lead(app, lead_id: int) -> ScoreResult:
    result = compute_score(app.settings, build_input(app, lead_id))
    next_action = {
        "alta": "preparar contato inicial",
        "media": "preparar contato inicial",
        "pesquisa_adicional": "pesquisar evidências e canal de contato",
        "observacao": "manter em observação",
    }[result.priority]
    with app.db.transaction():
        app.db.execute("UPDATE leads SET score=?, score_breakdown=?, priority=?, services=?, next_action=?, "
                       "updated_at=? WHERE id=?",
                       (result.total, json.dumps(result.breakdown | {"observacoes": result.notes}, ensure_ascii=False),
                        result.priority, json.dumps(result.services), next_action, iso(), lead_id))
    return result


def qualify_pending(app) -> dict:
    """Pontua leads abertos e avança PESQUISADO→QUALIFICADO (≥ limite) e QUALIFICADO→CONTATO_AUTORIZADO."""
    from ..compliance import lgpd
    from . import repository

    stats = {"pontuados": 0, "qualificados": 0, "autorizados": 0, "rebaixados": 0}
    min_score = int(app.settings.outreach["limits"].get("min_score_for_contact", 60))
    rows = app.db.all("SELECT id, status FROM leads WHERE status IN ('PESQUISADO','QUALIFICADO')")
    for row in rows:
        result = score_lead(app, row["id"])
        stats["pontuados"] += 1
        status = row["status"]
        if status == pipeline.PESQUISADO and result.total >= min_score:
            pipeline.transition(app, row["id"], pipeline.QUALIFICADO, evidence_type="score",
                                evidence_ref=result.total, reason=f"pontuação {result.total} ({result.priority})")
            stats["qualificados"] += 1
            status = pipeline.QUALIFICADO
        elif status == pipeline.QUALIFICADO and result.total < min_score:
            pipeline.transition(app, row["id"], pipeline.PESQUISADO, evidence_type="score",
                                evidence_ref=result.total, reason="pontuação abaixo do limite após reavaliação")
            stats["rebaixados"] += 1
            continue
        if status == pipeline.QUALIFICADO:
            contact = repository.primary_contact(app, row["id"])
            if contact is None:
                continue
            ok, _ = lgpd.has_valid_basis(app, contact["id"])
            blocked, _ = suppression.is_suppressed(app, email=contact["email"])
            if ok and not blocked:
                pipeline.transition(app, row["id"], pipeline.CONTATO_AUTORIZADO, evidence_type="base_legal",
                                    evidence_ref=f"contato:{contact['id']}:{contact['legal_basis']}",
                                    reason="canal legítimo com base legal registrada")
                stats["autorizados"] += 1
    return stats
