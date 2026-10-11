"""Enriquecimento a partir do site oficial (páginas públicas, robots.txt respeitado).

Extrai: título, segmento por palavras-chave, e-mails corporativos genéricos publicados no próprio domínio,
CNPJ publicado no site (validado) e sinais de possível demanda. Tudo vira evidência com URL e data.
O que o site diz é FATO ("o site menciona X"); a necessidade de SST inferida é HIPÓTESE.
"""
from __future__ import annotations

import html
import re
from urllib.parse import urljoin

from ..compliance import lgpd, suppression
from ..crm import repository
from ..integrations import registry
from ..integrations.base import NotConfigured, track_usage
from ..integrations.web import AccessDenied
from . import dedupe

EMAIL_IN_TEXT = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
CNPJ_IN_TEXT = re.compile(r"\b\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}\b")
TAG_RE = re.compile(r"<(script|style)[^>]*>.*?</\1>|<[^>]+>", re.S | re.I)
TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.S | re.I)


def page_text(raw_html: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(TAG_RE.sub(" ", raw_html))).strip()


def _excerpt(text: str, term: str, width: int = 90) -> str:
    idx = text.lower().find(term.lower())
    if idx < 0:
        return ""
    return text[max(0, idx - width): idx + len(term) + width].strip()


def detect_segment(settings, text: str) -> tuple[str, int]:
    low = text.lower()
    best, hits = "desconhecido", 0
    for segment, words in settings.research.get("segment_keywords", {}).items():
        count = sum(low.count(w.lower()) for w in words)
        if count > hits:
            best, hits = segment, count
    return best, hits


def extract_emails(settings, text: str, domain: str) -> list[str]:
    prefixes = settings.research.get("generic_email_prefixes", [])
    found = []
    for email in {e.lower().rstrip(".") for e in EMAIL_IN_TEXT.findall(text)}:
        local, _, host = email.partition("@")
        if dedupe.registrable_domain(host) != domain:
            continue  # só e-mails do próprio domínio da empresa
        if any(local.startswith(p) for p in prefixes):
            found.append(email)
    return sorted(found)


def extract_cnpjs(text: str) -> list[str]:
    return sorted({d for d in (dedupe.normalize_cnpj(m) for m in CNPJ_IN_TEXT.findall(text)) if d})


def enrich_company(app, company_id: int) -> dict:
    db = app.db
    company = db.one("SELECT * FROM companies WHERE id=?", (company_id,))
    if not company or not company["website"]:
        return {"status": "sem_site"}
    fetcher = registry.fetcher(app)
    pages, errors = {}, []
    for path in app.settings.research.get("contact_paths", ["/"]):
        url = urljoin(company["website"].rstrip("/") + "/", path.lstrip("/"))
        if url in pages:
            continue
        try:
            page = fetcher.get(url)
            if page.status == 200:
                pages[page.url] = page.text
        except AccessDenied as exc:
            errors.append(str(exc))
            break
        except Exception as exc:  # noqa: BLE001 - página indisponível: segue para a próxima
            errors.append(f"{url}: {type(exc).__name__}")
    if not pages:
        return {"status": "inacessivel", "erros": errors}

    result = {"status": "ok", "paginas": len(pages), "emails": [], "fatos": 0, "cnpj": None, "erros": errors}
    domain = company["domain"]
    first_url = next(iter(pages))
    source_id = lgpd.register_source(app, "site_oficial", f"site oficial da empresa ({domain})", url=first_url,
                                     terms_note="páginas públicas; robots.txt respeitado")
    all_text = ""
    for url, raw in pages.items():
        text = page_text(raw)
        all_text += " " + text
        title = TITLE_RE.search(raw)
        if title and url == first_url:
            repository.add_evidence(app, company_id, kind="FATO", tag="perfil", source_id=source_id, url=url,
                                    statement=f"Título do site oficial: {html.unescape(title.group(1)).strip()[:150]}")
        for email in extract_emails(app.settings, text, domain):
            if suppression.is_suppressed(app, email=email)[0]:
                continue
            added = repository.add_contact(app, company_id, email=email, contact_type="generic_corporate",
                                           source_id=source_id, source_url=url, legal_basis="legitimo_interesse",
                                           legal_basis_note=lgpd.LEGAL_BASES["legitimo_interesse"])
            if added:
                result["emails"].append(email)
        for tag, terms in app.settings.research.get("demand_signals", {}).items():
            if tag.startswith("_"):
                continue
            for term in terms:
                excerpt = _excerpt(text, term)
                if excerpt:
                    if repository.add_evidence(app, company_id, kind="FATO", tag=tag, source_id=source_id, url=url,
                                               statement=f"Site oficial menciona '{term}'", excerpt=excerpt):
                        result["fatos"] += 1
                        repository.add_evidence(app, company_id, kind="HIPOTESE", tag=tag, source_id=source_id,
                                                statement=f"Possível demanda de SST relacionada a '{term}' "
                                                          "(hipótese comercial, não verificada)", confidence="baixa")
                    break

    segment, hits = detect_segment(app.settings, all_text)
    if company["segment"] == "desconhecido" and hits >= 2:
        with db.transaction():
            db.execute("UPDATE companies SET segment=?, segment_confidence=? WHERE id=?",
                       (segment, "media" if hits >= 4 else "baixa", company_id))
        result["segmento"] = segment

    cnpjs = extract_cnpjs(all_text)
    if len(cnpjs) == 1 and not company["cnpj"]:
        cnpj = cnpjs[0]
        if not db.one("SELECT 1 FROM companies WHERE cnpj=?", (cnpj,)):
            with db.transaction():
                db.execute("UPDATE companies SET cnpj=? WHERE id=?", (cnpj, company_id))
            result["cnpj"] = cnpj
            _size_from_cnpj(app, company_id, cnpj)
    return result


def _size_from_cnpj(app, company_id: int, cnpj: str) -> None:
    provider = registry.cnpj(app)
    try:
        if not provider.is_configured():
            return
        track_usage(app, provider.name, 0.0)
        data = provider.lookup(cnpj)
    except NotConfigured:
        return
    except Exception as exc:  # noqa: BLE001
        app.log.warning("consulta CNPJ falhou: %s", type(exc).__name__)
        return
    size = provider.size_from(data)
    source_id = lgpd.register_source(app, "api_publica", "Cadastro CNPJ (Receita Federal) via BrasilAPI",
                                     url=provider.endpoint.format(cnpj=cnpj))
    with app.db.transaction():
        # "DEMAIS" no cadastro não distingue média de grande: registra 'media' com confiança baixa.
        app.db.execute("UPDATE companies SET size_estimate=?, size_source=?, size_confidence=?, legal_name="
                       "COALESCE(legal_name, ?), city=COALESCE(city, ?) WHERE id=?",
                       (size if size != "media_ou_grande" else "media", "porte declarado no cadastro CNPJ",
                        "baixa" if size == "media_ou_grande" else "media",
                        data.get("razao_social"), (data.get("municipio") or "").title() or None, company_id))
    repository.add_evidence(app, company_id, kind="FATO", tag="cadastro", source_id=source_id,
                            statement=f"Porte no cadastro CNPJ: {data.get('porte') or data.get('descricao_porte')}; "
                                      f"CNAE: {data.get('cnae_fiscal_descricao')}")
