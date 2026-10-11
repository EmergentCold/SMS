# CLAUDE.md — instruções para agentes neste projeto

Projeto: SST Autonomous Business Agent (consultoria em Segurança e Saúde no Trabalho, mercado brasileiro).
Idioma do produto e da documentação: português do Brasil.

## Comandos
- Testes: `python3 -m pytest -q` (rodar sempre antes de commitar).
- Simulação sem envio externo: `python3 -m src.main simulate`.
- Estado: `python3 -m src.main status`; integrações: `python3 -m src.main integrations --offline`.

## Regras invioláveis
1. Nunca inventar contatos, e-mails, preços, clientes, resultados de testes, mensagens enviadas ou contratos.
2. Nunca afirmar habilitação/registro/certificação do proprietário que não esteja marcada como verificada em
   `config/business.json`.
3. Todo envio externo passa por `src/outreach/sender.py::dispatch` — não criar caminho alternativo de envio.
4. Toda mudança de estado do lead passa por `src/crm/pipeline.py::transition` com evidência real.
5. Novas ações automatizadas precisam de entrada em `config/autonomy.json`; ação desconhecida exige aprovação.
6. Integração sem credencial levanta `NotConfigured` e registra pendência — nunca simular sucesso.
7. Segredos só por variável de ambiente; nada de credenciais em JSON, código, logs ou commits.
8. Fatos exigem fonte (`data_sources`/URL); inferências são `HIPOTESE`.
9. Dados operacionais (`data/`, `reports/`) nunca entram no Git (o repositório alimenta o GitHub Pages).
10. Não automatizar LinkedIn/redes sociais nem WhatsApp fora da API oficial com opt-in.

## Arquitetura
- `src/settings.py` (config, relógio, logging mascarado) · `src/database.py` (esquema, transações, backup)
- `src/compliance/` permissões/kill switch, supressão, LGPD, filtro de conteúdo
- `src/crm/` repositório com deduplicação, pontuação, pipeline, contratos/financeiro
- `src/research/` importação CSV, descoberta via API de busca, enriquecimento pelo site oficial
- `src/outreach/` composição, portão de envio, follow-ups, respostas, reuniões
- `src/proposals/` propostas a partir de catálogo + preços aprovados
- `src/analytics/` indicadores e relatórios · `src/scheduler.py` agendador persistente
- `src/integrations/` adaptadores substituíveis (SMTP, IMAP, busca, CNPJ, B2B, CRM, agenda, IA)

## Convenções
- Stdlib apenas em produção. Datas via `settings.iso()`/`now()` (America/Sao_Paulo); testes congelam `clock`.
- Idempotência por chaves únicas (`messages.idempotency_key`, `tasks.dedupe_key`, `job_runs`).
- Testes usam `tests/conftest.py::FakeChannel` e domínios `.test`.
