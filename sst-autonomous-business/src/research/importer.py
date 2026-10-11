"""Importação de leads levantados pelo proprietário ou por fonte autorizada (CSV).

Colunas: name, website, segment, city, state, cnpj, contact_email, contact_type, contact_name, contact_role,
source_url, source_description, legal_basis, facts, hypotheses, size_estimate, size_source, size_confidence.
`facts` e `hypotheses`: itens separados por " | "; fato no formato "tag: afirmação".
Toda linha precisa de source_url ou source_description (rastreabilidade).
"""
from __future__ import annotations

import csv
from pathlib import Path

from ..compliance import lgpd
from ..crm import repository
from . import dedupe

REQUIRED = {"name"}


def import_csv(app, path: Path, *, default_source_kind: str = "csv_proprietario") -> dict:
    stats = {"linhas": 0, "empresas_novas": 0, "duplicadas": 0, "contatos": 0, "rejeitadas": 0, "erros": []}
    with open(path, encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        missing = REQUIRED - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"CSV sem colunas obrigatórias: {sorted(missing)}")
        for n, row in enumerate(reader, start=2):
            stats["linhas"] += 1
            row = {k: (v or "").strip() for k, v in row.items() if k}
            try:
                _import_row(app, row, default_source_kind, stats)
            except ValueError as exc:
                stats["rejeitadas"] += 1
                stats["erros"].append(f"linha {n}: {exc}")
    app.db.audit("importacao_csv", details={"arquivo": path.name, **{k: v for k, v in stats.items() if k != 'erros'}})
    return stats


def _import_row(app, row: dict, source_kind: str, stats: dict) -> None:
    if not row.get("name"):
        raise ValueError("nome da empresa vazio")
    if not (row.get("source_url") or row.get("source_description")):
        raise ValueError("sem origem (source_url/source_description)")
    segment = row.get("segment") or "desconhecido"
    if segment not in app.settings.services["segments"]:
        raise ValueError(f"segmento desconhecido: {segment}")
    source_id = lgpd.register_source(app, source_kind, row.get("source_description") or row["source_url"],
                                     url=row.get("source_url") or None)
    result = repository.upsert_company(
        app, name=row["name"], website=row.get("website") or None, cnpj=row.get("cnpj") or None,
        segment=segment, segment_confidence="media" if segment != "desconhecido" else "baixa",
        city=row.get("city") or None, state=row.get("state") or "SP",
        size_estimate=row.get("size_estimate") or "desconhecido", size_source=row.get("size_source") or None,
        size_confidence=row.get("size_confidence") or "baixa", source_id=source_id,
        contact_email=row.get("contact_email") or None)
    stats["empresas_novas" if result.created else "duplicadas"] += 1
    company_id = result.company_id
    repository.ensure_lead(app, company_id)

    email = row.get("contact_email")
    if email:
        if not dedupe.email_is_valid(email):
            raise ValueError(f"e-mail inválido: {email}")
        ctype = row.get("contact_type") or "generic_corporate"
        basis = row.get("legal_basis") or "legitimo_interesse"
        if basis not in lgpd.LEGAL_BASES:
            raise ValueError(f"base legal inválida: {basis}")
        note = lgpd.LEGAL_BASES[basis]
        if repository.add_contact(app, company_id, email=email, name=row.get("contact_name") or None,
                                  role=row.get("contact_role") or None, contact_type=ctype, source_id=source_id,
                                  source_url=row.get("source_url") or None, legal_basis=basis,
                                  legal_basis_note=note):
            stats["contatos"] += 1

    for item in filter(None, (x.strip() for x in row.get("facts", "").split("|"))):
        tag, _, statement = item.partition(":") if ":" in item else ("", "", item)
        repository.add_evidence(app, company_id, kind="FATO", statement=statement.strip() or item,
                                tag=tag.strip() or None, source_id=source_id, url=row.get("source_url") or None)
    for item in filter(None, (x.strip() for x in row.get("hypotheses", "").split("|"))):
        repository.add_evidence(app, company_id, kind="HIPOTESE", statement=item, source_id=source_id,
                                confidence="baixa")
