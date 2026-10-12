"""Especificação OpenAPI 2.0 (Swagger) — formato exigido pelos conectores personalizados do Power Platform.

Gerar o arquivo para importar no Power Apps/Power Automate:
    python -m src.main openapi --host sst.seudominio.com.br
"""
from __future__ import annotations

from ..settings import env


def _ref(name: str) -> dict:
    return {"$ref": f"#/definitions/{name}"}


def _array(name: str) -> dict:
    return {"type": "array", "items": _ref(name)}


def _str(desc: str, **kw) -> dict:
    return {"type": "string", "description": desc, **kw}


def _int(desc: str) -> dict:
    return {"type": "integer", "format": "int32", "description": desc}


def _num(desc: str) -> dict:
    return {"type": "number", "format": "double", "description": desc}


DEFINITIONS = {
    "Lead": {"type": "object", "properties": {
        "id": _int("ID do lead"), "empresa": _str("Empresa"), "segmento": _str("Segmento"),
        "cidade": _str("Cidade"), "pontuacao": _int("Pontuação 0-100"), "prioridade": _str("Prioridade"),
        "status": _str("Estado no pipeline"), "status_rotulo": _str("Estado (rótulo)"),
        "proxima_acao": _str("Próxima ação"), "atualizado_em": _str("Atualizado em", format="date-time")}},
    "Aprovacao": {"type": "object", "properties": {
        "id": _int("ID da aprovação"), "action": _str("Ação"), "level": _int("Nível de autonomia"),
        "subject_type": _str("Tipo do assunto"), "subject_id": _int("ID do assunto"),
        "summary": _str("Resumo"), "status": _str("Situação"), "created_at": _str("Criado em", format="date-time")}},
    "Decisao": {"type": "object", "required": ["approve"], "properties": {
        "approve": {"type": "boolean", "description": "true aprova, false rejeita", "x-ms-summary": "Aprovar?"},
        "note": {**_str("Observação"), "x-ms-summary": "Observação"},
        "by": {**_str("Quem decidiu (e-mail)"), "x-ms-summary": "Decidido por"}}},
    "ResultadoDecisao": {"type": "object", "properties": {
        "approval_id": _int("ID"), "status": _str("APROVADO ou REJEITADO")}},
    "KillSwitch": {"type": "object", "required": ["on"], "properties": {
        "on": {"type": "boolean", "description": "true pausa os envios externos", "x-ms-summary": "Pausar envios?"},
        "reason": {**_str("Motivo"), "x-ms-summary": "Motivo"},
        "by": {**_str("Quem acionou"), "x-ms-summary": "Acionado por"}}},
    "ResultadoKillSwitch": {"type": "object", "properties": {
        "envios_pausados": {"type": "boolean"}, "motivo": _str("Motivo")}},
    "Inbound": {"type": "object", "required": ["from", "body"], "properties": {
        "from": {**_str("E-mail do remetente"), "x-ms-summary": "Remetente"},
        "subject": {**_str("Assunto"), "x-ms-summary": "Assunto"},
        "body": {**_str("Corpo em texto"), "x-ms-summary": "Corpo"},
        "message_id": {**_str("Internet Message-ID"), "x-ms-summary": "ID da mensagem"},
        "in_reply_to": {**_str("In-Reply-To"), "x-ms-summary": "Em resposta a"}}},
    "ResultadoInbound": {"type": "object", "properties": {
        "message_id": _int("ID interno"), "intent": _str("Intenção detectada"), "lead_id": _int("Lead"),
        "acoes": {"type": "array", "items": {"type": "string"}}, "status": _str("duplicada, se repetida")}},
    "Importacao": {"type": "object", "required": ["rows"], "properties": {
        "rows": {"type": "array", "items": {"type": "object", "properties": {
            "name": _str("Empresa"), "website": _str("Site oficial"), "segment": _str("Segmento (config/services.json)"),
            "city": _str("Cidade"), "state": _str("UF"), "cnpj": _str("CNPJ"), "contact_email": _str("E-mail comercial"),
            "contact_type": _str("generic_corporate, named_professional, inbound_request, referral_authorized"),
            "source_url": _str("URL de origem (obrigatório se não houver descrição)"),
            "source_description": _str("Descrição da origem"), "legal_basis": _str("legitimo_interesse | consentimento"),
            "facts": _str("Fatos 'tag: afirmação' separados por |")}}},
        "by": _str("Quem importou")}},
    "ResultadoImportacao": {"type": "object", "properties": {
        "linhas": _int(""), "empresas_novas": _int(""), "duplicadas": _int(""), "contatos": _int(""),
        "rejeitadas": _int(""), "erros": {"type": "array", "items": {"type": "string"}}}},
    "Mensagem": {"type": "object", "properties": {
        "id": _int("ID"), "lead_id": _int("Lead"), "direction": _str("OUT/IN"), "kind": _str("Tipo"),
        "status": _str("Situação"), "subject": _str("Assunto"), "error": _str("Motivo/erro"),
        "created_at": _str("Criada em"), "sent_at": _str("Enviada em")}},
    "Painel": {"type": "object", "properties": {
        "gerado_em": _str("Gerado em"), "envio_externo_habilitado": {"type": "boolean"},
        "kill_switch": {"type": "object", "properties": {"ativo": {"type": "boolean"}, "motivo": _str("")}},
        "identidade_configurada": {"type": "boolean"},
        "kpis": {"type": "object", "description": "Indicadores (chaves 'secao.indicador')"},
        "resumo": {"type": "object", "properties": {k: {"type": "number"} for k in (
            "leads_qualificados", "mensagens_enviadas", "taxa_resposta_pct", "respostas_positivas", "descadastros",
            "reunioes", "propostas_enviadas", "contratos", "receita_potencial", "receita_propostas",
            "receita_contratada", "receita_recebida", "mrr")}},
        "pipeline": {"type": "array", "items": {"type": "object", "properties": {
            "status": _str(""), "rotulo": _str(""), "quantidade": _int("")}}},
        "aprovacoes": _array("Aprovacao"), "leads": _array("Lead"),
        "mensagens_incertas": _int("Mensagens interrompidas durante o envio")}},
    "Erro": {"type": "object", "properties": {"erro": _str("Descrição do erro")}},
}


def _op(op_id: str, summary: str, description: str, response: dict | None, *, params: list | None = None,
        tags: str = "Agente") -> dict:
    responses = {"200": {"description": "OK", **({"schema": response} if response else {})},
                 "400": {"description": "Requisição inválida", "schema": _ref("Erro")},
                 "401": {"description": "Token inválido", "schema": _ref("Erro")}}
    return {"operationId": op_id, "summary": summary, "description": description, "tags": [tags],
            "parameters": params or [], "responses": responses}


def _path_id(name: str, desc: str) -> dict:
    return {"name": name, "in": "path", "required": True, "type": "integer", "description": desc,
            "x-ms-summary": desc}


def _body(schema: str) -> dict:
    return {"name": "body", "in": "body", "required": True, "schema": _ref(schema)}


def build_spec(host: str | None = None) -> dict:
    host = host or env("SST_API_PUBLIC_HOST") or "localhost:8765"
    scheme = "http" if host.startswith(("localhost", "127.0.0.1")) else "https"
    status_q = {"name": "status", "in": "query", "type": "string", "required": False,
                "description": "Filtrar por estado", "x-ms-summary": "Estado"}
    return {
        "swagger": "2.0",
        "info": {"title": "SST Agent", "version": "0.2.0",
                 "description": "Agente comercial de consultoria em SST: leads, aprovações, respostas, kill switch e "
                                "indicadores. Todas as ações respeitam os níveis de autonomia do agente."},
        "host": host,
        "basePath": "/",
        "schemes": [scheme],
        "consumes": ["application/json"],
        "produces": ["application/json"],
        "securityDefinitions": {"api_key": {"type": "apiKey", "in": "header", "name": "X-API-Key"}},
        "security": [{"api_key": []}],
        "paths": {
            "/api/painel": {"get": _op("ObterPainel", "Painel", "KPIs, pipeline, aprovações pendentes e leads.",
                                       _ref("Painel"))},
            "/api/leads": {"get": _op("ListarLeads", "Listar leads", "Leads ordenados por pontuação.",
                                      _array("Lead"), params=[status_q])},
            "/api/leads/import": {"post": _op("ImportarLeads", "Importar leads",
                                              "Importa leads com origem rastreável (mesmas regras do CSV).",
                                              _ref("ResultadoImportacao"), params=[_body("Importacao")])},
            "/api/approvals": {"get": _op("ListarAprovacoes", "Listar aprovações",
                                          "Pendências do proprietário (padrão: PENDENTE).", _array("Aprovacao"),
                                          params=[status_q])},
            "/api/approvals/{approval_id}/decision": {"post": _op(
                "DecidirAprovacao", "Aprovar ou rejeitar", "Registra a decisão do proprietário.",
                _ref("ResultadoDecisao"), params=[_path_id("approval_id", "ID da aprovação"), _body("Decisao")])},
            "/api/messages": {"get": _op("ListarMensagens", "Listar mensagens", "Últimas mensagens.",
                                         _array("Mensagem"), params=[status_q])},
            "/api/inbound": {"post": _op("RegistrarResposta", "Registrar resposta recebida",
                                         "Envia ao agente um e-mail recebido (ex.: gatilho do Outlook).",
                                         _ref("ResultadoInbound"), params=[_body("Inbound")])},
            "/api/kill-switch": {"post": _op("KillSwitch", "Pausar/retomar envios",
                                             "Liga ou desliga o interruptor de emergência dos envios externos.",
                                             _ref("ResultadoKillSwitch"), params=[_body("KillSwitch")])},
            "/api/jobs/{name}": {"post": _op(
                "ExecutarRotina", "Executar rotina", "qualify, outreach, followups, daily_report, weekly_report, "
                "powerbi_export ou recover.", {"type": "object"},
                params=[{"name": "name", "in": "path", "required": True, "type": "string",
                         "enum": ["qualify", "outreach", "followups", "daily_report", "weekly_report",
                                  "powerbi_export", "recover"], "x-ms-summary": "Rotina"}])},
        },
        "definitions": DEFINITIONS,
    }
