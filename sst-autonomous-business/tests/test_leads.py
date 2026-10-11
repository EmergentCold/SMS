import json

import pytest

from src.crm import pipeline, repository, scoring
from src.crm.scoring import ScoreInput, classify, compute_score
from src.compliance import suppression
from src.research import importer
from tests.conftest import make_lead


def test_score_is_bounded_and_breakdown_respects_limits(app):
    best = compute_score(app.settings, ScoreInput(segment="centro_distribuicao", size="media", demand_facts=10,
                                                  best_channel="generic_corporate", city="Guarulhos", state="SP"))
    assert 0 <= best.total <= 100
    for key, maximum in scoring.MAX.items():
        assert 0 <= best.breakdown[key] <= maximum
    worst = compute_score(app.settings, ScoreInput())
    assert worst.total < 40
    assert worst.priority == "observacao"


@pytest.mark.parametrize("total,expected", [(100, "alta"), (80, "alta"), (79, "media"), (60, "media"),
                                            (59, "pesquisa_adicional"), (40, "pesquisa_adicional"),
                                            (39, "observacao"), (0, "observacao")])
def test_classification_thresholds(total, expected):
    assert classify(total) == expected


def test_geography_and_channel_points(app):
    base = dict(segment="industria", size="pequena", demand_facts=0, best_channel="generic_corporate")
    gru = compute_score(app.settings, ScoreInput(**base, city="Guarulhos", state="SP"))
    metro = compute_score(app.settings, ScoreInput(**base, city="Barueri", state="SP"))
    interior = compute_score(app.settings, ScoreInput(**base, city="Campinas", state="SP"))
    other = compute_score(app.settings, ScoreInput(**base, city="Curitiba", state="PR"))
    assert gru.breakdown["geografia"] == 10 and metro.breakdown["geografia"] == 8
    assert interior.breakdown["geografia"] == 5 and other.breakdown["geografia"] == 2
    none = compute_score(app.settings, ScoreInput(**{**base, "best_channel": None}, city="Guarulhos", state="SP"))
    assert none.breakdown["canal"] == 0 and "sem canal comercial legítimo" in none.notes


def test_only_facts_count_as_demand_evidence(app):
    lead_id = make_lead(app, facts=0, authorize=False)
    company_id = app.db.scalar("SELECT company_id FROM leads WHERE id=?", (lead_id,))
    repository.add_evidence(app, company_id, kind="HIPOTESE", tag="expansao", statement="talvez expanda")
    assert scoring.build_input(app, lead_id).demand_facts == 0
    repository.add_evidence(app, company_id, kind="FATO", tag="expansao", statement="site menciona nova unidade",
                            url="https://transp-teste.test")
    assert scoring.build_input(app, lead_id).demand_facts == 1


def test_fact_without_source_is_rejected(app):
    lead_id = make_lead(app, authorize=False)
    company_id = app.db.scalar("SELECT company_id FROM leads WHERE id=?", (lead_id,))
    with pytest.raises(ValueError):
        repository.add_evidence(app, company_id, kind="FATO", statement="sem fonte")


def test_qualification_moves_pipeline_with_evidence(app):
    lead_id = make_lead(app)
    history = repository.lead_view(app, lead_id)["history"]
    assert [h["to_status"] for h in history] == ["PESQUISADO", "QUALIFICADO", "CONTATO_AUTORIZADO"]
    assert history[1]["evidence_type"] == "score" and history[2]["evidence_type"] == "base_legal"
    breakdown = json.loads(app.db.scalar("SELECT score_breakdown FROM leads WHERE id=?", (lead_id,)))
    assert set(scoring.MAX) <= set(breakdown)


def test_low_score_lead_stays_researched(app):
    lead_id = make_lead(app, name="Empresa X", website="https://x-desconhecida.test", segment="desconhecido",
                        city="Curitiba", size="desconhecido", email=None, facts=0, authorize=False)
    scoring.qualify_pending(app)
    assert app.db.scalar("SELECT status FROM leads WHERE id=?", (lead_id,)) == pipeline.PESQUISADO


def test_suppressed_contact_is_not_authorized(app):
    suppression.add_email(app, "contato@transp-teste.test", "teste")
    lead_id = make_lead(app, authorize=False)
    scoring.qualify_pending(app)
    assert app.db.scalar("SELECT status FROM leads WHERE id=?", (lead_id,)) != pipeline.CONTATO_AUTORIZADO


def test_csv_import_requires_traceable_source(app, tmp_path):
    csv_file = tmp_path / "leads.csv"
    csv_file.write_text(
        "name,website,segment,city,contact_email,source_url,source_description,facts\n"
        "Empresa A,https://a-empresa.test,industria,Guarulhos,contato@a-empresa.test,https://a-empresa.test/contato,"
        "site oficial,expansao: site menciona nova unidade\n"
        "Empresa B,https://b-empresa.test,industria,Guarulhos,contato@b-empresa.test,,,\n",
        encoding="utf-8")
    stats = importer.import_csv(app, csv_file)
    assert stats["empresas_novas"] == 1 and stats["rejeitadas"] == 1
    assert "sem origem" in stats["erros"][0]
    row = app.db.one("SELECT ds.url FROM contacts c JOIN data_sources ds ON ds.id = c.source_id")
    assert row["url"] == "https://a-empresa.test/contato"
