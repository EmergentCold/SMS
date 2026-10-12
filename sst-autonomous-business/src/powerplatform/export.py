"""Exportação para Power BI e Power Apps.

- Tabelas em CSV (UTF-8 com BOM, separador vírgula), modelo estrela, para Power BI.
- `painel.json`: retrato compacto para Power Apps/Power Automate (KPIs, aprovações, leads, pendências).

Minimização (LGPD): nenhuma tabela exporta corpo de mensagem, telefone ou nome de pessoa; e-mails saem
mascarados. Os dados completos permanecem só no SQLite.
"""
from __future__ import annotations

import csv
import io
import json
import os
from pathlib import Path

from ..analytics import metrics
from ..compliance import permissions, suppression
from ..crm.pipeline import LABELS
from ..settings import env, iso

TABLES: dict[str, str] = {
    "dim_empresa": (
        "SELECT id AS empresa_id, name AS nome, segment AS segmento, segment_confidence AS segmento_confianca, "
        "city AS cidade, state AS uf, size_estimate AS porte, size_confidence AS porte_confianca, "
        "domain AS dominio, is_simulation AS simulacao, created_at AS criado_em FROM companies"),
    "fato_lead": (
        "SELECT id AS lead_id, company_id AS empresa_id, status, NULL AS status_rotulo, score AS pontuacao, "
        "priority AS prioridade, services AS servicos, next_action AS proxima_acao, "
        "first_contact_at AS primeiro_contato_em, won_at AS ganho_em, lost_reason AS motivo_perda, "
        "created_at AS criado_em, updated_at AS atualizado_em FROM leads"),
    "fato_pipeline_eventos": (
        "SELECT id AS evento_id, lead_id, from_status AS de, to_status AS para, evidence_type AS evidencia, "
        "reason AS motivo, created_at AS data FROM lead_events"),
    "fato_mensagens": (
        "SELECT id AS mensagem_id, lead_id, direction AS direcao, channel AS canal, kind AS tipo, step AS etapa, "
        "status, intent AS intencao, attempts AS tentativas, created_at AS criado_em, sent_at AS enviado_em "
        "FROM messages"),
    "fato_propostas": (
        "SELECT id AS proposta_id, lead_id, service_code AS servico, version AS versao, status, "
        "list_price AS preco_tabela, discount_pct AS desconto_pct, final_price AS preco_final, unit AS unidade, "
        "valid_until AS validade, created_at AS criado_em, sent_at AS enviado_em FROM proposals"),
    "fato_contratos": (
        "SELECT id AS contrato_id, lead_id, proposal_id AS proposta_id, total_value AS valor_total, "
        "monthly_value AS valor_mensal, recurring AS recorrente, signed_at AS assinado_em, start_date AS inicio, "
        "end_date AS fim, status FROM contracts"),
    "fato_financeiro": (
        "SELECT id AS lancamento_id, contract_id AS contrato_id, kind AS tipo, category AS categoria, "
        "amount AS valor, status, due_date AS vencimento, paid_at AS pago_em FROM financial_entries"),
    "fato_reunioes": (
        "SELECT id AS reuniao_id, lead_id, starts_at AS inicio, ends_at AS fim, status FROM meetings"),
    "aprovacoes": (
        "SELECT id AS aprovacao_id, action AS acao, level AS nivel, subject_type AS assunto_tipo, "
        "subject_id AS assunto_id, summary AS resumo, status, decided_by AS decidido_por, "
        "created_at AS criado_em, decided_at AS decidido_em FROM approvals"),
    "custos_ferramentas": (
        "SELECT integration AS integracao, day AS dia, calls AS chamadas, est_cost AS custo_estimado "
        "FROM integration_usage"),
    "contatos_canal": (
        "SELECT id AS contato_id, company_id AS empresa_id, contact_type AS tipo, legal_basis AS base_legal, "
        "status, email AS email_mascarado, created_at AS criado_em FROM contacts"),
}


def export_dir(app) -> Path:
    """Pasta da ponte. Aponte POWERPLATFORM_DIR para uma pasta sincronizada do OneDrive/SharePoint.
    A simulação nunca escreve na pasta real."""
    base = env("POWERPLATFORM_DIR")
    if app.settings.simulation or not base:
        return app.settings.data_dir / "powerplatform"
    return Path(base)


def table_rows(app, name: str) -> tuple[list[str], list[list]]:
    if name not in TABLES:
        raise KeyError(f"tabela desconhecida: {name}")
    cur = app.db.execute(TABLES[name])
    headers = [d[0] for d in cur.description]
    rows = [list(r) for r in cur.fetchall()]
    if name == "fato_lead":
        idx = headers.index("status_rotulo")
        status_idx = headers.index("status")
        for r in rows:
            r[idx] = LABELS.get(r[status_idx], r[status_idx])
    if name == "contatos_canal":
        idx = headers.index("email_mascarado")
        for r in rows:
            r[idx] = suppression.mask_email(r[idx]) if r[idx] else None
    return headers, rows


def table_csv(app, name: str) -> str:
    headers, rows = table_rows(app, name)
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")
    writer.writerow(headers)
    writer.writerows(rows)
    return buf.getvalue()


def kpis_flat(app) -> dict:
    data = metrics.compute(app)
    flat = {"gerado_em": data["gerado_em"]}
    for section in ("contato", "vendas", "receita", "custos"):
        for key, value in data[section].items():
            flat[f"{section}.{key}"] = value
    flat["pesquisa.empresas_pesquisadas"] = data["pesquisa"]["empresas_pesquisadas"]
    flat["pesquisa.leads_qualificados"] = data["pesquisa"]["leads_qualificados"]
    return flat


def snapshot(app, max_leads: int = 200) -> dict:
    """Retrato para Power Apps (via fluxo) e para o painel JavaScript."""
    db = app.db
    paused, why = permissions.is_paused(app)
    leads = [dict(r) for r in db.all(
        "SELECT l.id, c.name AS empresa, c.segment AS segmento, c.city AS cidade, l.score AS pontuacao, "
        "l.priority AS prioridade, l.status, l.next_action AS proxima_acao, l.updated_at AS atualizado_em "
        "FROM leads l JOIN companies c ON c.id = l.company_id ORDER BY l.score DESC NULLS LAST, l.id LIMIT ?",
        (max_leads,))]
    for lead in leads:
        lead["status_rotulo"] = LABELS.get(lead["status"], lead["status"])
    k = kpis_flat(app)
    resumo = {  # nomes simples (sem pontos) para uso direto no Power Fx
        "leads_qualificados": k.get("pesquisa.leads_qualificados"),
        "mensagens_enviadas": k.get("contato.mensagens_enviadas"),
        "taxa_resposta_pct": k.get("contato.taxa_resposta_pct"),
        "respostas_positivas": k.get("contato.respostas_positivas"),
        "descadastros": k.get("contato.descadastros"),
        "reunioes": k.get("vendas.reunioes"),
        "propostas_enviadas": k.get("vendas.propostas_enviadas"),
        "contratos": k.get("vendas.contratos_fechados"),
        "receita_potencial": k.get("receita.1_potencial_estimada"),
        "receita_propostas": k.get("receita.2_propostas_emitidas_valor"),
        "receita_contratada": k.get("receita.3_contratada_valor"),
        "receita_recebida": k.get("receita.4_recebida_valor"),
        "mrr": k.get("receita.receita_recorrente_mensal"),
    }
    return {
        "gerado_em": iso(),
        "simulacao": app.settings.simulation,
        "envio_externo_habilitado": app.settings.external_sending_enabled,
        "kill_switch": {"ativo": paused, "motivo": why},
        "identidade_configurada": app.settings.owner_identity_configured(),
        "kpis": k,
        "resumo": resumo,
        "pipeline": [{"status": s, "rotulo": LABELS.get(s, s), "quantidade": n} for s, n in
                     ((r["status"], r["n"]) for r in db.all("SELECT status, COUNT(*) n FROM leads GROUP BY status"))],
        "aprovacoes": [dict(r) for r in db.all(
            "SELECT id, action, level, subject_type, subject_id, summary, created_at FROM approvals "
            "WHERE status='PENDENTE' ORDER BY id")],
        "integracoes_pendentes": [dict(r) for r in db.all(
            "SELECT name, reason, action_needed, last_seen FROM pending_integrations ORDER BY name")],
        "mensagens_incertas": db.scalar("SELECT COUNT(*) FROM messages WHERE status='INCERTA'"),
        "leads": leads,
    }


def _atomic_write(path: Path, content: str, encoding: str = "utf-8") -> None:
    """Escreve em arquivo temporário e renomeia: o OneDrive/Power BI nunca lê arquivo pela metade."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(content, encoding=encoding)
    os.replace(tmp, path)


def sync_approval_files(app) -> dict:
    """Um arquivo por aprovação pendente em `aprovacoes/` (gatilho "Quando um arquivo é criado" do Power Automate).

    Cada aprovação gera o arquivo uma única vez; ao ser decidida, o arquivo é removido.
    """
    folder = export_dir(app) / "aprovacoes"
    folder.mkdir(parents=True, exist_ok=True)
    pending = {int(r["id"]): r for r in app.db.all(
        "SELECT id, action, level, subject_type, subject_id, summary, created_at FROM approvals WHERE status='PENDENTE'")}
    created = removed = 0
    for approval_id, row in pending.items():
        key = f"notified:approval:{approval_id}"
        if app.db.get_meta(key):
            continue
        payload = dict(row) | {"titulo": f"SST Agent: {row['summary']}"[:250],
                               "nivel_descricao": {1: "automático", 2: "limite configurado",
                                                   3: "validação humana obrigatória"}.get(row["level"], "")}
        _atomic_write(folder / f"aprovacao-{approval_id}.json", json.dumps(payload, ensure_ascii=False, default=str))
        with app.db.transaction():
            app.db.set_meta(key, iso())
        created += 1
    for path in folder.glob("aprovacao-*.json"):
        try:
            approval_id = int(path.stem.split("-", 1)[1])
        except ValueError:
            continue
        if approval_id not in pending:
            path.unlink(missing_ok=True)
            removed += 1
    return {"criados": created, "removidos": removed}


def export_all(app) -> dict:
    root = export_dir(app) / "export"
    files = []
    for name in TABLES:
        _atomic_write(root / f"{name}.csv", table_csv(app, name), encoding="utf-8-sig")
        files.append(f"{name}.csv")
    kpis = kpis_flat(app)
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")
    writer.writerow(["indicador", "valor"])
    writer.writerows([[k, v] for k, v in kpis.items()])
    _atomic_write(root / "kpis.csv", buf.getvalue(), encoding="utf-8-sig")
    files.append("kpis.csv")
    _atomic_write(root / "painel.json", json.dumps(snapshot(app), ensure_ascii=False, indent=1, default=str))
    files.append("painel.json")
    _atomic_write(root / "manifest.json", json.dumps({"gerado_em": iso(), "arquivos": files}, ensure_ascii=False))
    approvals = sync_approval_files(app)
    return {"pasta": str(root), "arquivos": len(files), "aprovacoes": approvals}
