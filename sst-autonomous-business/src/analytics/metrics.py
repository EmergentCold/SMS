"""Indicadores comerciais e financeiros.

Separação obrigatória: receita potencial (estimada) ≠ propostas emitidas ≠ contratada ≠ recebida.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from ..settings import iso, now, parse_dt


def _rate(num: float, den: float) -> float | None:
    return round(100.0 * num / den, 1) if den else None


def compute(app, since: datetime | None = None) -> dict:
    db = app.db
    since_iso = iso(since) if since else "0000"
    q = lambda sql, *p: db.scalar(sql, p) or 0  # noqa: E731

    companies = q("SELECT COUNT(*) FROM companies WHERE created_at >= ?", since_iso)
    qualified = q("SELECT COUNT(DISTINCT lead_id) FROM lead_events WHERE to_status='QUALIFICADO' AND created_at >= ?",
                  since_iso)
    by_segment = {r["segment"]: r["n"] for r in db.all(
        "SELECT c.segment, COUNT(*) AS n FROM leads l JOIN companies c ON c.id = l.company_id "
        "WHERE l.status NOT IN ('PESQUISADO') GROUP BY c.segment ORDER BY n DESC")}
    by_status = {r["status"]: r["n"] for r in db.all("SELECT status, COUNT(*) AS n FROM leads GROUP BY status")}

    attempted = q("SELECT COUNT(*) FROM messages WHERE direction='OUT' AND status IN ('ENVIADA','FALHOU','INCERTA') "
                  "AND updated_at >= ?", since_iso)
    sent = q("SELECT COUNT(*) FROM messages WHERE direction='OUT' AND status='ENVIADA' AND sent_at >= ?", since_iso)
    first_sent = q("SELECT COUNT(*) FROM messages WHERE direction='OUT' AND status='ENVIADA' AND kind='first_contact' "
                   "AND sent_at >= ?", since_iso)
    bounces = q("SELECT COUNT(*) FROM messages WHERE direction='IN' AND intent='ENDERECO_INVALIDO' AND created_at >= ?",
                since_iso)
    replied_leads = q("SELECT COUNT(DISTINCT lead_id) FROM messages WHERE direction='IN' AND lead_id IS NOT NULL "
                      "AND intent NOT IN ('ENDERECO_INVALIDO') AND created_at >= ?", since_iso)
    contacted_leads = q("SELECT COUNT(DISTINCT lead_id) FROM messages WHERE direction='OUT' AND status='ENVIADA' "
                        "AND kind='first_contact' AND sent_at >= ?", since_iso)
    positive = q("SELECT COUNT(*) FROM messages WHERE direction='IN' AND intent IN ('INTERESSE','PERGUNTA') "
                 "AND created_at >= ?", since_iso)
    optouts = q("SELECT COUNT(*) FROM messages WHERE direction='IN' AND intent='DESCADASTRO' AND created_at >= ?",
                since_iso)
    meetings = q("SELECT COUNT(*) FROM meetings WHERE status IN ('CONFIRMADA','REALIZADA') AND created_at >= ?",
                 since_iso)
    proposals_sent = q("SELECT COUNT(*) FROM proposals WHERE status IN ('ENVIADA','ACEITA','RECUSADA','EXPIRADA') "
                       "AND sent_at >= ?", since_iso)
    proposals_value = q("SELECT COALESCE(SUM(final_price),0) FROM proposals WHERE status IN ('ENVIADA','ACEITA') "
                        "AND sent_at >= ?", since_iso)
    pending_price = q("SELECT COUNT(*) FROM proposals WHERE status='PRECO_PENDENTE'")
    contracts = q("SELECT COUNT(*) FROM contracts WHERE signed_at >= ?", since_iso[:10])
    contracted = q("SELECT COALESCE(SUM(total_value),0) FROM contracts WHERE signed_at >= ?", since_iso[:10])
    mrr = q("SELECT COALESCE(SUM(monthly_value),0) FROM contracts WHERE status='ATIVO' AND recurring=1")
    received = q("SELECT COALESCE(SUM(amount),0) FROM financial_entries WHERE kind='RECEITA' AND status='REALIZADO' "
                 "AND paid_at >= ?", since_iso[:10])
    receivable = q("SELECT COALESCE(SUM(amount),0) FROM financial_entries WHERE kind='RECEITA' AND status='PREVISTO'")
    expenses = q("SELECT COALESCE(SUM(amount),0) FROM financial_entries WHERE kind='DESPESA' AND status='REALIZADO' "
                 "AND paid_at >= ?", since_iso[:10])
    tool_costs = q("SELECT COALESCE(SUM(est_cost),0) FROM integration_usage WHERE day >= ?", since_iso[:10])

    # Receita potencial: preço de tabela aprovado do 1º serviço sugerido para leads abertos qualificados.
    potential, potential_unpriced = 0.0, 0
    pricing = app.settings.pricing.get("services", {})
    import json
    for row in db.all("SELECT services FROM leads WHERE status IN ('QUALIFICADO','CONTATO_AUTORIZADO','CONTATADO',"
                      "'RESPONDEU','REUNIAO','PROPOSTA','NEGOCIACAO','AGUARDANDO_APROVACAO')"):
        codes = json.loads(row["services"] or "[]")
        p = pricing.get(codes[0]) if codes else None
        if p and p.get("status") == "aprovado" and p.get("list_price"):
            potential += float(p["list_price"])
        else:
            potential_unpriced += 1

    cycle_days = []
    for row in db.all("SELECT first_contact_at, won_at FROM leads WHERE won_at IS NOT NULL AND first_contact_at IS NOT NULL"):
        start, end = parse_dt(row["first_contact_at"]), parse_dt(row["won_at"])
        cycle_days.append((end - start).total_seconds() / 86400)

    margin_base = contracted
    est_costs = expenses + tool_costs
    return {
        "periodo_desde": since_iso if since else "início",
        "gerado_em": iso(),
        "pesquisa": {"empresas_pesquisadas": companies, "leads_qualificados": qualified,
                     "leads_por_segmento": by_segment, "leads_por_estado": by_status},
        "contato": {"mensagens_enviadas": sent, "primeiros_contatos": first_sent,
                    "taxa_entrega_pct": _rate(sent - bounces, attempted) if attempted else None,
                    "devolucoes": bounces, "leads_que_responderam": replied_leads,
                    "taxa_resposta_pct": _rate(replied_leads, contacted_leads),
                    "respostas_positivas": positive, "descadastros": optouts,
                    "reclamacoes": optouts},
        "vendas": {"reunioes": meetings, "propostas_enviadas": proposals_sent,
                   "propostas_com_preco_pendente": pending_price,
                   "contratos_fechados": contracts,
                   "taxa_conversao_pct": _rate(contracts, contacted_leads),
                   "tempo_medio_primeiro_contato_ate_venda_dias":
                       round(sum(cycle_days) / len(cycle_days), 1) if cycle_days else None},
        "receita": {
            "1_potencial_estimada": round(potential, 2),
            "1_potencial_leads_sem_preco": potential_unpriced,
            "2_propostas_emitidas_valor": round(proposals_value, 2),
            "3_contratada_valor": round(contracted, 2),
            "4_recebida_valor": round(received, 2),
            "a_receber_previsto": round(receivable, 2),
            "receita_recorrente_mensal": round(mrr, 2),
        },
        "custos": {"despesas_realizadas": round(expenses, 2), "custo_ferramentas_estimado": round(tool_costs, 2),
                   "margem_estimada_sobre_contratado": round(margin_base - est_costs, 2) if margin_base else None,
                   "margem_realizada": round(received - est_costs, 2)},
    }


def window(days: int) -> datetime:
    return now() - timedelta(days=days)
