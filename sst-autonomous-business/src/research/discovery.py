"""Descoberta de empresas por API de busca autorizada + enriquecimento pelo site oficial.

Sem chave de busca configurada, registra a pendência e não simula resultados. A alternativa
manual é `python -m src.main leads import arquivo.csv`.
"""
from __future__ import annotations

import itertools

from ..compliance import lgpd
from ..crm import repository
from ..integrations import registry
from ..integrations.base import BudgetExceeded, NotConfigured, record_pending, track_usage
from ..settings import now
from . import dedupe, enrichment


def _blocked(app, domain: str | None) -> bool:
    if not domain:
        return True
    blocked = app.settings.research.get("blocked_domains", [])
    return any(domain == b or domain.endswith("." + b) for b in blocked) or domain.endswith(".gov.br")


def build_queries(app) -> list[tuple[str, str, str, str]]:
    cfg = app.settings.research
    cities = cfg["start_region"]["cities"]
    uf_inicial = cfg["start_region"].get("state", "SP")
    out = []
    for city, (segment, templates) in itertools.product(cities, cfg["queries"].items()):
        for template in templates:
            out.append((segment, city, uf_inicial, template.format(city=city)))
    national = cfg.get("national", {})
    for (city, _uf), segment in itertools.product(national.get("cities", []), national.get("segments", [])):
        for template in cfg["queries"].get(segment, []):
            out.append((segment, city, _uf, template.format(city=city).replace(" SP", f" {_uf}")))
    return out


def run(app, max_queries: int | None = None) -> dict:
    provider = registry.search(app)
    if not provider.is_configured():
        record_pending(app, "busca_web_brave", "pesquisa automática sem API de busca",
                       "definir BRAVE_SEARCH_API_KEY no .env ou importar CSV com `leads import`")
        return {"status": "PENDENTE_INTEGRACAO", "acao": "configurar BRAVE_SEARCH_API_KEY ou importar CSV"}
    cfg = app.settings.research
    limit = max_queries or int(cfg.get("max_queries_per_run", 20))
    done = {r["value"] for r in app.db.all("SELECT value FROM meta WHERE key LIKE 'query:%'")}
    stats = {"consultas": 0, "resultados": 0, "empresas_novas": 0, "duplicadas": 0, "ignoradas": 0, "enriquecidas": 0}
    monthly_cap = int(cfg.get("max_search_calls_per_month", 0) or 0)
    month = now().strftime("%Y-%m")
    used = int(app.db.scalar("SELECT COALESCE(SUM(calls),0) FROM integration_usage WHERE integration=? "
                             "AND day LIKE ?", (provider.name, month + "%")) or 0)
    for segment, city, uf, query in build_queries(app):
        if stats["consultas"] >= limit:
            break
        if monthly_cap and used + stats["consultas"] >= monthly_cap:
            stats["parado_por_limite_mensal"] = monthly_cap
            app.log.warning("pesquisa pausada: limite mensal de %s buscas (plano gratuito) atingido", monthly_cap)
            break
        if query in done:
            continue
        try:
            track_usage(app, provider.name, getattr(provider, "cost_per_call", 0.0))
            hits = provider.search(query, count=int(cfg.get("max_results_per_query", 10)))
        except (NotConfigured, BudgetExceeded) as exc:
            app.log.warning("pesquisa interrompida: %s", exc)
            break
        except Exception as exc:  # noqa: BLE001
            app.log.error("falha na busca '%s': %s", query, type(exc).__name__)
            continue
        stats["consultas"] += 1
        with app.db.transaction():
            app.db.set_meta(f"query:{query}", query)
        source_id = lgpd.register_source(app, "busca_api", f"resultado de busca: '{query}'", url=None,
                                         terms_note="API de busca com termos de uso aceitos")
        for hit in hits:
            stats["resultados"] += 1
            domain = dedupe.company_domain(hit.url)
            if _blocked(app, domain):
                stats["ignoradas"] += 1
                continue
            name = (hit.title.split("|")[0].split(" - ")[0]).strip()[:120] or domain
            result = repository.upsert_company(app, name=name, website=f"https://{domain}", segment=segment,
                                               segment_confidence="baixa", city=city, state=uf,
                                               source_id=source_id)
            repository.ensure_lead(app, result.company_id)
            repository.add_evidence(app, result.company_id, kind="HIPOTESE", tag="segmento", source_id=source_id,
                                    statement=f"Segmento '{segment}' e município '{city}' inferidos da busca "
                                              f"'{query}' (confirmar no site)", confidence="baixa")
            if result.created:
                stats["empresas_novas"] += 1
                enriched = enrichment.enrich_company(app, result.company_id)
                stats["enriquecidas"] += int(enriched.get("status") == "ok")
            else:
                stats["duplicadas"] += 1
    app.db.audit("pesquisa_executada", details=stats)
    return stats


def enrich_pending(app, limit: int = 20) -> dict:
    """Enriquece empresas com site e sem contato registrado."""
    rows = app.db.all("SELECT c.id FROM companies c WHERE c.website IS NOT NULL AND NOT EXISTS "
                      "(SELECT 1 FROM contacts k WHERE k.company_id = c.id) AND c.is_simulation = 0 AND NOT EXISTS "
                      "(SELECT 1 FROM meta m WHERE m.key = 'enriched:' || c.id) LIMIT ?", (limit,))
    out = {"processadas": 0, "ok": 0}
    for row in rows:
        out["processadas"] += 1
        with app.db.transaction():
            app.db.set_meta(f"enriched:{row['id']}", "1")  # uma tentativa por empresa (não insistir no site)
        out["ok"] += int(enrichment.enrich_company(app, row["id"]).get("status") == "ok")
    return out
