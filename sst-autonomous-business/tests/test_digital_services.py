from src.crm import repository, scoring
from src.outreach import composer
from src.proposals import generator
from src.research import discovery
from tests.conftest import make_lead


def test_digital_services_are_priced_and_remote(app):
    services, pricing = app.settings.services["services"], app.settings.pricing["services"]
    for code in "JKLMNOP":
        assert services[code]["category"] == "digital" and services[code]["available"]
        assert pricing[code]["status"] == "aprovado" and pricing[code]["min_price"] <= pricing[code]["list_price"]
        for upsell in services[code]["upsell"]:
            assert upsell in services, (code, upsell)
    assert all(services[c]["delivery"] == "remoto" for c in "JKLMNO")


def test_consultancy_segment_gets_digital_pitch_nationwide(app):
    lead_id = make_lead(app, name="Consultoria Exemplo", website="https://consult.test", segment="consultoria_sst",
                        city="Curitiba", email="contato@consult.test", authorize=False)
    scoring.qualify_pending(app)
    lead = repository.lead_view(app, lead_id)
    assert set(lead["services"]) <= set("JKLMNOP")
    v = composer.base_variables(app, lead, {})
    msg = composer.render_message(app.settings.templates_dir, "first_contact", "default", v)
    assert "QR Code" in msg.body and "todo o Brasil" in msg.body
    assert msg.body.count("QR Code") == 1  # sem repetir a linha digital


def test_logistics_lead_mentions_digital_line(app):
    lead_id = make_lead(app)
    v = composer.base_variables(app, repository.lead_view(app, lead_id), {})
    msg = composer.render_message(app.settings.templates_dir, "first_contact", "default", v)
    assert "crachás com QR Code" in msg.body and "diagnóstico preliminar" in msg.body


def test_proposal_for_digital_service(app):
    lead_id = make_lead(app)
    res = generator.create_proposal(app, lead_id, "K")
    text = open(res["arquivo"], encoding="utf-8").read()
    assert res["status"] == "PRONTA" and "R$ 490,00" in text and "Planilha inteligente" in text


def test_national_queries_keep_state(app):
    queries = discovery.build_queries(app)
    curitiba = [q for q in queries if q[1] == "Curitiba"]
    assert curitiba and all(q[2] == "PR" for q in curitiba)
    assert all(" SP" not in q[3] for q in curitiba)


def test_search_stops_at_free_monthly_cap(app):
    from src.integrations.providers import SearchHit

    class FakeSearch:
        name = "busca_web_brave"
        cost_per_call = 0.0
        def is_configured(self):
            return True
        def search(self, query, count=10):
            return [SearchHit("Empresa", "https://empresa-cap.test", "")]

    app.overrides["search"] = FakeSearch()
    app.overrides["fetcher"] = type("F", (), {"get": lambda self, url: (_ for _ in ()).throw(OSError("sem rede"))})()
    app.settings.research["max_search_calls_per_month"] = 3
    out = discovery.run(app, max_queries=10)
    assert out["consultas"] == 3 and out["parado_por_limite_mensal"] == 3
    assert discovery.run(app, max_queries=10)["consultas"] == 0  # mês já no limite
