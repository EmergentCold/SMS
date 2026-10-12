# SST Autonomous Business Agent

Sistema comercial automatizado para consultoria em Segurança e Saúde no Trabalho (SST), com foco em PMEs de
Guarulhos, São Paulo e região metropolitana. Pesquisa, qualifica, prepara e envia contatos, acompanha
follow-ups, gera propostas, atualiza o CRM e produz relatórios — **dentro dos limites legais, técnicos e
comerciais configurados**, com aprovação humana onde há responsabilidade técnica, jurídica, financeira ou
contratual.

- Python 3.11+ sem dependências de execução (só biblioteca padrão). `pytest` para testes.
- CRM em SQLite (`data/sst.db`), SQL portável para PostgreSQL.
- Agendador persistente próprio (cron + registro de execuções no banco), recupera execuções após reinício.
- Fuso: America/Sao_Paulo em todas as datas (ISO 8601 com offset).

## Instalação automática no Windows

Abra o **PowerShell** do Windows (não precisa ser administrador) e cole:

```powershell
winget install --id Git.Git -e; git clone --branch claude/sst-autonomous-agent-scmmqs https://github.com/EmergentCold/SMS.git $env:USERPROFILE\sst-agent; powershell -NoProfile -ExecutionPolicy Bypass -File $env:USERPROFILE\sst-agent\sst-autonomous-business\instalar\instalar_windows.ps1
```

O instalador ([`instalar/instalar_windows.ps1`](instalar/instalar_windows.ps1)) **pede confirmação em cada etapa**:
instala Git, Python, Power BI Desktop e (opcional) Node.js via `winget`; baixa o código; cria a pasta
`OneDrive/SST-Agent` da ponte; gera o `.env` com tokens aleatórios e restringe o acesso a ele; pergunta sua
identidade comercial; roda testes, simulação e a primeira exportação; registra o agente (e, se quiser, a
API/painel) como tarefa agendada que inicia com o Windows; oferece copiar a pasta
"Segurança do Trabalho em Projetos" da Área de Trabalho (com alerta de dados pessoais, pois o repositório é público); e abre os guias e os sites do Power Automate e do Power Apps. Depois de clonado, também dá para rodar
`instalar\INSTALAR.cmd` com duplo clique. Para desfazer as tarefas: `instalar_windows.ps1 -Remover`.

O envio externo continua desligado: nenhum e-mail sai até você configurar o SMTP e habilitar
`EXTERNAL_SENDING_ENABLED`.

## Início rápido

```bash
cd sst-agent/sst-autonomous-business
python3 -m pip install -r requirements.txt   # só para rodar os testes
cp .env.example .env                          # credenciais (opcional no início)
python3 -m src.main init                      # cria banco e pastas
python3 -m pytest -q                          # testes automatizados
python3 -m src.main simulate                  # simulação ponta a ponta SEM envio externo
python3 -m src.main integrations --offline    # o que está configurado
python3 -m src.main status                    # visão geral
```

A simulação usa banco separado (`data/simulation.db`), empresas fictícias em domínios `.test` (RFC 2606) e
grava as "mensagens" em `data/simulation_outbox/`. Nenhuma conexão de rede é feita.

## Configuração mínima antes de operar

| # | O quê | Onde |
|---|---|---|
| 1 | Seu nome, nome comercial, e-mail comercial (e registro, se for citar) | `config/business.json` |
| 2 | Capacidade real (horas/semana, contratos simultâneos) | `config/business.json → capacity` |
| 3 | Preços mínimo e de tabela por serviço, status `aprovado` | `config/pricing.json` |
| 4 | Condições de pagamento | `config/pricing.json → defaults.payment_terms` |
| 5 | Limites de envio e horário | `config/outreach.json` |
| 6 | O que o agente pode fazer sozinho (nível 2) | `config/autonomy.json` |
| 7 | E-mail SMTP/IMAP do seu domínio | `.env` |
| 8 | Chave de busca (opcional; senão use CSV) | `.env → BRAVE_SEARCH_API_KEY` |

Enquanto 1 não estiver preenchido, nenhuma mensagem é preparada. Enquanto 3 não estiver aprovado, propostas
saem como **RASCUNHO — PREÇO PENDENTE** e não podem ser enviadas. Enquanto `EXTERNAL_SENDING_ENABLED=false`,
nada sai do sistema.

## Operação

### Iniciar
```bash
python3 -m src.main daemon            # processo contínuo (Ctrl+C ou SIGTERM encerra com segurança)
# ou, em contêiner:
docker compose up -d --build
# ou via cron do sistema (sem processo contínuo), a cada 5 minutos:
# */5 * * * * cd /caminho/sst-agent/sst-autonomous-business && python3 -m src.main run-once >> data/logs/cron.log 2>&1
```
O agendador usa uma trava com heartbeat: só uma instância opera por vez. Após reinício, executa uma vez o
disparo perdido mais recente de cada job (janela `misfire_grace_minutes`), marca jobs interrompidos como
FALHOU e marca mensagens interrompidas no meio do envio como **INCERTA** (nunca reenviadas automaticamente).

### Monitorar
```bash
python3 -m src.main status             # estado, kill switch, trava do agendador, pendências, próximos jobs
python3 -m src.main approvals list     # fila de decisões do proprietário
python3 -m src.main messages --status AGUARDANDO_APROVACAO
python3 -m src.main messages --show 12 # conteúdo de uma mensagem
python3 -m src.main report daily       # relatório agora (também gerado automaticamente)
tail -f data/logs/app.log              # log (segredos mascarados); falhas em data/logs/alerts.log
```

### Decidir pendências
```bash
python3 -m src.main approvals approve 3 --note "ok"
python3 -m src.main approvals reject 4 --note "ajustar texto"
```

### Pausar envios imediatamente (kill switch)
```bash
python3 -m src.main kill-switch on --reason "revisão"   # ou: touch data/STOP_SENDING  ou  KILL_SWITCH=true
python3 -m src.main kill-switch off
```
Com o kill switch ativo, as tarefas de nível 1 (pesquisa, qualificação, rascunhos, relatórios) continuam.

### Encerrar
```bash
python3 -m src.main stop               # pede ao daemon para sair no próximo ciclo
docker compose down                    # em contêiner (SIGTERM, 60 s de tolerância)
```

### Rotinas do dia a dia
```bash
python3 -m src.main leads import minha_lista.csv          # ver examples/leads_template.csv
python3 -m src.main leads list --status RESPONDEU
python3 -m src.main leads show 7
python3 -m src.main inbound add --from cliente@empresa.com.br --subject "Re: ..." --body "Temos interesse"
python3 -m src.main meeting create 7 "2026-10-20 14:00" --minutes 30
python3 -m src.main proposal create 7 A
python3 -m src.main proposal send 3
python3 -m src.main contract --lead 7 --proposal 3 --total 1500 --signed-at 2026-10-25 --confirm-signed
python3 -m src.main finance RECEITA 750 --status REALIZADO --contract 1 --paid-at 2026-10-26
python3 -m src.main finance DESPESA 49.90 --status REALIZADO --category ferramenta --paid-at 2026-10-01
python3 -m src.main leads transition 9 PERDIDO --reason "cliente fechou com concorrente"
python3 -m src.main job research        # executa um job agora
python3 -m src.main backup
```

### LGPD
```bash
python3 -m src.main lgpd export titular@empresa.com.br
python3 -m src.main lgpd object titular@empresa.com.br      # oposição: supressão + cancelamento
python3 -m src.main lgpd delete titular@empresa.com.br      # eliminação (mantém só o hash na supressão)
python3 -m src.main lgpd suppress-domain empresa.com.br
python3 -m src.main lgpd retention
```

## Power Apps, Power Automate, Power BI e JavaScript

O motor é Python; o Microsoft Power Platform e o painel web são a camada de operação.
Guia completo: [`powerplatform/README.md`](powerplatform/README.md).

| Camada | O que faz | Como iniciar |
|---|---|---|
| **Painel JavaScript** (`web/`) | KPIs, funil, receita em 4 categorias, aprovar/rejeitar, pausar envios, leads, registrar respostas, rodar rotinas | `SST_API_TOKEN=<24+ caracteres> python3 -m src.main api` → http://127.0.0.1:8765 |
| **Power BI** | Relatório gerencial a partir dos CSVs exportados (modelo estrela, sem dados pessoais) | `python3 -m src.main powerbi-export` + [`powerplatform/power-bi/MODELO.md`](powerplatform/power-bi/MODELO.md) |
| **Power Automate** | Aprovações no Teams/Outlook, respostas do Outlook → agente, alertas, botão de pausa no celular, importação de leads do Excel | [`powerplatform/power-automate/FLUXOS.md`](powerplatform/power-automate/FLUXOS.md) |
| **Power Apps** | App de celular para decidir aprovações, pausar envios e consultar leads | [`powerplatform/power-apps/APP.md`](powerplatform/power-apps/APP.md) |
| **Conector personalizado** (Premium) | 9 operações da API para Power Apps/Automate | [`powerplatform/custom-connector/`](powerplatform/custom-connector/) |

- **Modo A (licença padrão do Microsoft 365):** ponte por arquivos numa pasta do OneDrive/SharePoint
  (`POWERPLATFORM_DIR`): o agente exporta `export/*.csv` e `painel.json`, cria `aprovacoes/aprovacao-<id>.json`
  e processa comandos de `inbox/*.json` a cada minuto (`python3 -m src.main bridge` para rodar já).
- **Modo B (Premium):** conector personalizado → API REST publicada por túnel HTTPS.
- Todas as ações vindas do Power Platform ou do painel passam pelas mesmas regras: níveis de autonomia,
  aprovações, kill switch, supressão e portão de envio. Ações `human_only` nunca são executadas.

```bash
cd web && npm test                 # testes do JavaScript (node --test)
npm i -D playwright && npx playwright install chromium && npm run e2e   # teste no navegador
```

## Níveis de autonomia (`config/autonomy.json`)

| Nível | Comportamento | Exemplos |
|---|---|---|
| 1 | Automático | pesquisar, deduplicar, pontuar, atualizar CRM, rascunhos, relatórios, follow-ups de sequência autorizada, FAQ aprovada |
| 2 | Automático **só se `enabled: true`**; senão fila de aprovação | contato inicial, resposta fora da FAQ, enviar proposta, reunião, desconto no limite |
| 3 | Sempre aprovação humana; `human_only` nunca é executado pelo agente | assinar contrato, laudos, responsabilidade técnica, conformidade legal, pagamentos, desconto acima do limite |

Padrão seguro: todas as ações de nível 2 começam **desabilitadas**. Ação não listada = exige aprovação.

## Pipeline

`PESQUISADO → QUALIFICADO → CONTATO_AUTORIZADO → CONTATADO → RESPONDEU → REUNIAO → PROPOSTA → NEGOCIACAO → GANHO | PERDIDO`
\+ `DESCADASTRADO`, `BLOQUEADO`, `AGUARDANDO_APROVACAO`.
Cada transição exige evidência verificada no banco (mensagem enviada/recebida, reunião, proposta enviada,
contrato confirmado). `DESCADASTRADO` nunca reabre.

## Integrações

| Integração | Estado sem configuração | Para ativar | Custo/limites | Teste |
|---|---|---|---|---|
| E-mail SMTP | mensagens ficam `PENDENTE_INTEGRACAO` | `SMTP_*` no `.env` | do seu provedor (limites diários de envio) | `integrations` (login sem enviar) |
| E-mail IMAP | respostas via `inbound add` manual | `IMAP_*` | — | `integrations` |
| Busca web (Brave Search API) | pesquisa por CSV | `BRAVE_SEARCH_API_KEY` | plano da Brave; informe `BRAVE_SEARCH_COST_BRL` | `integrations` (1 consulta) |
| Cadastro CNPJ (BrasilAPI) | sem porte oficial | `CNPJ_LOOKUP_ENABLED=true` | gratuito; uso moderado | `integrations` |
| Provedor B2B | não usado | contratar provedor licenciado + adaptador | contrato | — |
| CRM externo | CRM local SQLite | `EXTERNAL_CRM*` + adaptador | — | — |
| Agenda | convites `.ics` em `data/meetings/` | OAuth Google/Microsoft (futuro) | — | — |
| Armazenamento de propostas | `data/proposals/*.md` (ativo) | — | — | — |
| Modelo de IA (Anthropic) | classificação por regras | `ANTHROPIC_API_KEY`, `AI_MODEL` | por uso; `AI_COST_PER_CALL_BRL` | `integrations` |
| Agendador | ativo (interno) | — | — | `status` |

Orçamento mensal de ferramentas: `config/business.json → costs.monthly_budget_brl`. Ao atingir, as chamadas
pagas são bloqueadas (`BudgetExceeded`).

## Estrutura

```
config/      parâmetros editáveis (negócio, serviços, preços, contato, autonomia, pesquisa, agenda)
knowledge/   perfil, catálogo, playbook, conformidade, fontes oficiais
workflows/   procedimentos operacionais de cada etapa
templates/   modelos aprovados (contato, follow-up, resposta, reunião, proposta)
src/         aplicação (research, crm, outreach, proposals, compliance, analytics, integrations, api, powerplatform)
web/         painel JavaScript (sem build) servido pela API
powerplatform/ guias e artefatos de Power BI, Power Automate, Power Apps e conector personalizado
tests/       testes automatizados (pytest)
examples/    modelo de CSV para importação
data/        banco, logs, backups, propostas (fora do Git)
reports/     relatórios (fora do Git)
```

## Segurança

- Segredos só em `.env`/variáveis de ambiente; `.env`, `data/` e `reports/` estão no `.gitignore`.
- Logs e erros passam por mascaramento (valores de variáveis `*PASSWORD*`, `*TOKEN*`, `*KEY*`, `*SECRET*`,
  `Bearer ...`, `token=...`).
- Backups diários com rotação (`data/backups/`).
- Este repositório é publicado no GitHub Pages a partir da branch `main`: **nunca** versione dados de leads.
