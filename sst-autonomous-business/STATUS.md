# Relatório de implantação — versão 0.2 (2026-10-12)

Situação real do sistema após a primeira etapa. Nada aqui é estimado: cada item foi executado no ambiente de
desenvolvimento (contêiner Linux, Python 3.13, **sem acesso de rede às APIs externas** e sem Docker daemon).

## Funcional e testado

| Capacidade | Evidência |
|---|---|
| Banco SQLite persistente (16 entidades, transações, savepoints, WAL, backup com rotação) | `test_database_persists_between_sessions` |
| Deduplicação por CNPJ (com dígito verificador), domínio, e-mail e telefone | `tests/test_duplicates.py` (13 casos) |
| Pontuação 0–100 com 6 critérios, faixas e transições com evidência | `tests/test_leads.py` |
| Rastreabilidade: fatos sem fonte e contatos sem origem são rejeitados | `test_fact_without_source_is_rejected`, `test_contact_without_source_is_rejected`, importação CSV |
| Pipeline com 13 estados; transições inválidas/sem evidência bloqueadas; DESCADASTRADO não reabre | `test_pipeline_*`, `test_unsubscribed_lead_never_reopens` |
| Portão de envio único (13 verificações) | `tests/test_permissions.py` |
| Nenhum envio sem integração válida, sem `EXTERNAL_SENDING_ENABLED`, com kill switch ou fora do horário | testes correspondentes |
| Idempotência e recuperação: mensagem interrompida vira INCERTA e nunca é reenviada | `test_crash_during_send_never_resends`, `test_dispatch_is_idempotent` |
| Follow-ups D3/D7/D14 cancelados por resposta, descadastro, negativa ou bounce | `tests/test_optout.py` |
| Lista de supressão (hash), oposição, exportação e eliminação LGPD | `test_lgpd_erasure_keeps_only_suppression_hash` e outros |
| Filtro de alegações proibidas (falsa auditoria, indicação, promessa de conformidade) | `test_content_guard_*` |
| Propostas com escopo/preço configurados; preço pendente bloqueia envio; descontos por nível | `tests/test_proposals.py` |
| Receita potencial ≠ proposta ≠ contratada ≠ recebida | `test_metrics_separate_*` |
| Agendador: cron, execução única por horário, recuperação após reinício, trava de instância | `tests/test_scheduler.py` |
| Logs e erros sem credenciais | `test_log_redaction`, `test_logger_file_output_is_redacted`, `test_failed_job_is_recorded_and_redacted` |
| CLI completa (init, status, leads, approvals, messages, inbound, proposal, meeting, contract, finance, report, kill-switch, lgpd, job, daemon, run-once, stop, backup, simulate) | execução manual |
| Daemon: inicia, mantém heartbeat, encerra com SIGTERM liberando a trava | execução manual |
| Simulação ponta a ponta sem rede (pesquisa → qualificação → aprovação → envio simulado → follow-up → resposta → descadastro → reunião → proposta → contrato → recebimento → kill switch → relatório) | `python -m src.main simulate` |

| API REST com token (stdlib), painel JavaScript e especificação OpenAPI 2.0 (9 operações) | `tests/test_api.py` |
| Exportação Power BI (11 tabelas + KPIs + painel.json) sem dados pessoais; consultas M e medidas DAX conferidas contra as colunas reais | `tests/test_powerplatform.py` |
| Ponte por arquivos para Power Automate (aprovações, kill switch, respostas, importação, rotinas), idempotente e com token opcional | `tests/test_powerplatform.py` |
| Painel JavaScript: funções e cliente da API | `cd web && npm test` (4 testes) |
| Painel JavaScript no navegador (login, KPIs, funil, filtro, aprovação, kill switch, registro de resposta) | `npm run e2e` (Playwright/Chromium) |

Resultado: **100 testes Python aprovados** (`python3 -m pytest -q`), **4 testes JavaScript aprovados**
(`node --test`) e **teste ponta a ponta no Chromium aprovado**.

## Implementado, mas não verificado contra o serviço real (sem credencial/rede neste ambiente)

| Integração | O que falta para verificar |
|---|---|
| SMTP (envio) | preencher `SMTP_*` e rodar `python -m src.main integrations` (faz login sem enviar) |
| IMAP (respostas) | preencher `IMAP_*` e rodar `integrations` |
| Brave Search API (descoberta) | criar chave e definir `BRAVE_SEARCH_API_KEY` |
| BrasilAPI (porte/CNAE por CNPJ) | `CNPJ_LOOKUP_ENABLED=true` + rede |
| Leitura de sites oficiais (robots.txt) | rede liberada; testado apenas por código, não contra sites reais |
| Anthropic (sugestão de respostas, opcional) | `ANTHROPIC_API_KEY` + `AI_MODEL` |
| Docker / docker-compose | arquivos prontos; build não executado (daemon Docker indisponível aqui) |

## Power Platform — preparado, não executado (exige o seu tenant Microsoft 365)

| Artefato | Situação |
|---|---|
| 7 fluxos do Power Automate (`powerplatform/power-automate/FLUXOS.md`) | passo a passo com expressões; montar no seu ambiente |
| App do Power Apps (`powerplatform/power-apps/APP.md`) | fórmulas Power Fx por controle; montar no Power Apps Studio |
| Relatório Power BI (`powerplatform/power-bi/`) | consultas M, medidas DAX e tema prontos; montar no Power BI Desktop |
| Conector personalizado (`powerplatform/custom-connector/apiDefinition.swagger.json`) | importar; exige licença Premium e API publicada por HTTPS |

## Somente interface (adaptador específico não implementado)
Provedor B2B licenciado, CRM externo, agenda Google/Microsoft (os convites `.ics` locais funcionam),
WhatsApp Business Platform.

## Pendências do proprietário (bloqueiam operação externa)

1. `config/business.json`: nome, nome comercial, e-mail comercial, capacidade real (`capacity.verified`).
2. `config/pricing.json`: preços mínimos/de tabela e condições de pagamento; mudar `status` para `aprovado`.
3. `.env`: SMTP/IMAP do domínio profissional; opcionalmente `BRAVE_SEARCH_API_KEY`.
4. Revisar `templates/*.md` e `config/outreach.json` (textos, limites, FAQ).
5. Revisão jurídica de `knowledge/legal_compliance.md` (base legal, teste de legítimo interesse).
6. Confirmar nas fontes oficiais os itens de `knowledge/official_sources.md` marcados como "consultar".
7. Pasta "Segurança do Trabalho em Projetos" da Área de Trabalho: não acessível a partir deste ambiente
   (ver instruções no README da raiz do repositório).

## Próxima etapa executável

1. Preencher itens 1–3 → `python -m src.main integrations` deve mostrar SMTP/IMAP verificados.
2. Importar a primeira lista real (`examples/leads_template.csv` como modelo) → `job qualify` → revisar
   `leads list`.
3. `job outreach` com nível 2 desabilitado → aprovar manualmente as 10 primeiras mensagens.
4. `EXTERNAL_SENDING_ENABLED=true` → `daemon` (ou `docker compose up -d`).
5. Após 2 semanas, revisar o relatório semanal e decidir sobre habilitar `send_first_contact` no nível 2.
