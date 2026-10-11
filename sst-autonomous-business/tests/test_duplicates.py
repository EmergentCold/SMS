import pytest

from src.crm import repository
from src.research import dedupe
from src.outreach import sender
from tests.conftest import make_lead


@pytest.mark.parametrize("raw", ["https://www.Empresa.com.br/contato", "http://empresa.com.br", "empresa.com.br/",
                                 "WWW.EMPRESA.COM.BR", "https://loja.empresa.com.br/x?y=1", "vendas@empresa.com.br"])
def test_domain_normalization(raw):
    assert dedupe.company_domain(raw) == "empresa.com.br"


def test_cnpj_validation():
    assert dedupe.cnpj_is_valid("11.222.333/0001-81")
    assert dedupe.normalize_cnpj("11.222.333/0001-81") == "11222333000181"
    assert not dedupe.cnpj_is_valid("11.222.333/0001-82")
    assert not dedupe.cnpj_is_valid("00000000000000")
    assert dedupe.normalize_cnpj("123") is None


def test_duplicate_company_by_domain_is_merged(app):
    first = repository.upsert_company(app, name="Alfa Log", website="https://www.alfalog.test")
    second = repository.upsert_company(app, name="ALFA LOGÍSTICA LTDA", website="http://alfalog.test/contato",
                                       city="Guarulhos")
    assert not second.created and second.company_id == first.company_id and second.matched_by == "dominio"
    assert app.db.scalar("SELECT COUNT(*) FROM companies") == 1
    assert app.db.scalar("SELECT city FROM companies") == "Guarulhos"  # completa campo vazio


def test_duplicate_company_by_cnpj(app):
    first = repository.upsert_company(app, name="Beta", cnpj="11.222.333/0001-81")
    second = repository.upsert_company(app, name="Beta Indústria", website="https://beta.test", cnpj="11222333000181")
    assert second.company_id == first.company_id and second.matched_by == "cnpj"


def test_duplicate_company_by_contact_email(app):
    lead_id = make_lead(app, authorize=False)
    res = repository.upsert_company(app, name="Outro nome", contact_email="CONTATO@transp-teste.test")
    assert not res.created
    assert res.company_id == app.db.scalar("SELECT company_id FROM leads WHERE id=?", (lead_id,))


def test_free_email_domain_is_not_company_domain(app):
    a = repository.upsert_company(app, name="A", website="https://gmail.com")
    b = repository.upsert_company(app, name="B", website="https://gmail.com")
    assert a.created and b.created


def test_duplicate_contact_and_lead_are_ignored(app):
    lead_id = make_lead(app, authorize=False)
    company_id = app.db.scalar("SELECT company_id FROM leads WHERE id=?", (lead_id,))
    again = repository.add_contact(app, company_id, email="contato@transp-teste.test", source_url="https://x.test",
                                   legal_basis="legitimo_interesse")
    assert again is None
    assert repository.ensure_lead(app, company_id) == lead_id
    assert app.db.scalar("SELECT COUNT(*) FROM leads") == 1


def test_contact_without_source_is_rejected(app):
    res = repository.upsert_company(app, name="C", website="https://c.test")
    with pytest.raises(ValueError):
        repository.add_contact(app, res.company_id, email="contato@c.test")


def test_same_message_is_not_created_twice(app):
    lead_id = make_lead(app)
    contact_id = app.db.scalar("SELECT id FROM contacts")
    a = sender.create_outbound(app, lead_id=lead_id, contact_id=contact_id, kind="first_contact", subject="s",
                               body="b", idempotency_key="lead:1:seq:0")
    b = sender.create_outbound(app, lead_id=lead_id, contact_id=contact_id, kind="first_contact", subject="s",
                               body="b", idempotency_key="lead:1:seq:0")
    assert a[0] == b[0] and a[1] is True and b[1] is False
    assert app.db.scalar("SELECT COUNT(*) FROM messages") == 1
