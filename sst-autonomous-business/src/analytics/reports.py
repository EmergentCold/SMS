"""Relatórios diário e semanal (Markdown + JSON em reports/)."""
from __future__ import annotations

import json
from pathlib import Path

from ..compliance import permissions
from ..crm.pipeline import LABELS
from ..settings import now
from . import metrics


def _brl(value) -> str:
    if value is None:
        return "—"
    text = f"{float(value):,.2f}"
    return "R$ " + text.replace(",", "X").replace(".", ",").replace("X", ".")


def _pct(value) -> str:
    return "—" if value is None else f"{value:.1f}%"


def build(app, kind: str = "diario") -> tuple[Path, Path]:
    days = 1 if kind == "diario" else 7
    data = metrics.compute(app, metrics.window(days))
    totals = metrics.compute(app)
    db = app.db
    pending_approvals = [dict(r) for r in db.all(
        "SELECT id, action, level, summary, created_at FROM approvals WHERE status='PENDENTE' ORDER BY id")]
    pending_integrations = [dict(r) for r in db.all("SELECT * FROM pending_integrations ORDER BY name")]
    failures = [dict(r) for r in db.all(
        "SELECT job_name, scheduled_for, detail FROM job_runs WHERE status='FALHOU' ORDER BY id DESC LIMIT 10")]
    uncertain = db.scalar("SELECT COUNT(*) FROM messages WHERE status='INCERTA'")
    reviews = db.scalar("SELECT COUNT(*) FROM tasks WHERE kind='revisao_manual' AND status='PENDENTE'")
    paused, why = permissions.is_paused(app)
    top = [dict(r) for r in db.all(
        "SELECT l.id, c.name, c.segment, c.city, l.score, l.priority, l.status, l.next_action FROM leads l "
        "JOIN companies c ON c.id = l.company_id WHERE l.status NOT IN ('PERDIDO','DESCADASTRADO','BLOQUEADO','GANHO') "
        "ORDER BY l.score DESC NULLS LAST LIMIT 10")]

    stamp = now().strftime("%Y-%m-%d")
    title = "Relatório comercial diário" if kind == "diario" else "Relatório semanal de conversão"
    sim = " — SIMULAÇÃO (dados fictícios)" if app.settings.simulation else ""
    r, c, v, p = data["receita"], data["contato"], data["vendas"], data["pesquisa"]
    tr = totals["receita"]
    lines = [
        f"# {title} — {stamp}{sim}", "",
        f"Período: últimos {days} dia(s). Gerado em {data['gerado_em']}.", "",
        f"**Envios externos:** {'PAUSADOS (' + why + ')' if paused else 'ativos'} · "
        f"**Envio externo habilitado:** {'sim' if app.settings.external_sending_enabled else 'não'}", "",
        "## Prospecção", "",
        "| Indicador | Período | Total |", "|---|---:|---:|",
        f"| Empresas pesquisadas | {p['empresas_pesquisadas']} | {totals['pesquisa']['empresas_pesquisadas']} |",
        f"| Leads qualificados | {p['leads_qualificados']} | {totals['pesquisa']['leads_qualificados']} |",
        f"| Mensagens enviadas | {c['mensagens_enviadas']} | {totals['contato']['mensagens_enviadas']} |",
        f"| Primeiros contatos | {c['primeiros_contatos']} | {totals['contato']['primeiros_contatos']} |",
        f"| Taxa de entrega | {_pct(c['taxa_entrega_pct'])} | {_pct(totals['contato']['taxa_entrega_pct'])} |",
        f"| Taxa de resposta | {_pct(c['taxa_resposta_pct'])} | {_pct(totals['contato']['taxa_resposta_pct'])} |",
        f"| Respostas positivas | {c['respostas_positivas']} | {totals['contato']['respostas_positivas']} |",
        f"| Descadastros/reclamações | {c['descadastros']} | {totals['contato']['descadastros']} |",
        f"| Reuniões | {v['reunioes']} | {totals['vendas']['reunioes']} |",
        f"| Propostas enviadas | {v['propostas_enviadas']} | {totals['vendas']['propostas_enviadas']} |",
        f"| Contratos fechados | {v['contratos_fechados']} | {totals['vendas']['contratos_fechados']} |",
        f"| Conversão (contratos/contatados) | {_pct(v['taxa_conversao_pct'])} | {_pct(totals['vendas']['taxa_conversao_pct'])} |",
        "",
        "## Receita (não somar categorias diferentes)", "",
        "| Categoria | Período | Total |", "|---|---:|---:|",
        f"| 1. Potencial estimada (preço de tabela, leads abertos) | — | {_brl(tr['1_potencial_estimada'])} "
        f"(+{tr['1_potencial_leads_sem_preco']} leads sem preço aprovado) |",
        f"| 2. Propostas emitidas | {_brl(r['2_propostas_emitidas_valor'])} | {_brl(tr['2_propostas_emitidas_valor'])} |",
        f"| 3. Contratada (contratos assinados) | {_brl(r['3_contratada_valor'])} | {_brl(tr['3_contratada_valor'])} |",
        f"| 4. Recebida (dinheiro em conta) | {_brl(r['4_recebida_valor'])} | {_brl(tr['4_recebida_valor'])} |",
        f"| A receber (previsto) | — | {_brl(tr['a_receber_previsto'])} |",
        f"| Receita recorrente mensal (MRR) | — | {_brl(tr['receita_recorrente_mensal'])} |",
        "",
        f"Custos de ferramentas (estimado, período): {_brl(data['custos']['custo_ferramentas_estimado'])} · "
        f"Despesas realizadas: {_brl(data['custos']['despesas_realizadas'])} · "
        f"Margem realizada: {_brl(totals['custos']['margem_realizada'])}",
        f"Tempo médio 1º contato → venda: {totals['vendas']['tempo_medio_primeiro_contato_ate_venda_dias'] or '—'} dias",
        "",
        "## Pipeline", "",
        " · ".join(f"{LABELS.get(k, k)}: {n}" for k, n in sorted(totals["pesquisa"]["leads_por_estado"].items())) or "vazio",
        "",
        "## Prioridades (top 10 por pontuação)", "",
        "| Lead | Empresa | Segmento | Cidade | Pontos | Estado | Próxima ação |", "|---|---|---|---|---:|---|---|",
    ]
    lines += [f"| #{t['id']} | {t['name']} | {t['segment']} | {t['city'] or '—'} | {t['score'] or '—'} | "
              f"{t['status']} | {t['next_action'] or '—'} |" for t in top] or ["| — | | | | | | |"]
    lines += ["", f"## Pendências do proprietário ({len(pending_approvals)} aprovações)", ""]
    lines += [f"- #{a['id']} [nível {a['level']}] {a['summary']}" for a in pending_approvals] or ["- nenhuma"]
    lines += ["", "## Integrações pendentes", ""]
    lines += [f"- **{i['name']}**: {i['reason']} → {i['action_needed'] or 'ver README'}" for i in pending_integrations] \
        or ["- nenhuma registrada"]
    lines += ["", "## Alertas", "",
              f"- Mensagens em estado INCERTO (revisar antes de reenviar): {uncertain}",
              f"- Mensagens recebidas aguardando revisão manual: {reviews}"]
    lines += [f"- Falha no job {f['job_name']} ({f['scheduled_for']}): {f['detail']}" for f in failures]
    lines += ["", "> A pontuação de leads indica potencial comercial e não comprova irregularidade ou necessidade "
                  "técnica. Receita potencial não é receita contratada nem recebida."]

    app.settings.reports_dir.mkdir(parents=True, exist_ok=True)
    prefix = "simulacao-" if app.settings.simulation else ""
    md = app.settings.reports_dir / f"{prefix}{kind}-{stamp}.md"
    js = app.settings.reports_dir / f"{prefix}{kind}-{stamp}.json"
    md.write_text("\n".join(lines) + "\n", encoding="utf-8")
    js.write_text(json.dumps({"periodo": data, "acumulado": totals, "aprovacoes_pendentes": pending_approvals,
                              "integracoes_pendentes": pending_integrations}, ensure_ascii=False, indent=2,
                             default=str), encoding="utf-8")
    return md, js
