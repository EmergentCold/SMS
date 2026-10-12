# Fluxos do Power Automate

Convenções:
- Pasta do OneDrive: `/SST-Agent` (a mesma de `POWERPLATFORM_DIR`). Ajuste se usar SharePoint.
- Nomes de ações em português (interface pt-BR). Em inglês, os nomes equivalentes estão entre parênteses.
- Expressões são digitadas na aba **Expressão** do conteúdo dinâmico.
- Se `SST_BRIDGE_TOKEN` estiver definido, todo comando precisa do campo `"token"`. Guarde o valor numa
  variável do fluxo (ou num Azure Key Vault, se tiver Premium) — nunca no Power Apps.
- Todos os fluxos 1–7 usam **somente conectores padrão** (OneDrive for Business, Aprovações, Outlook, Teams,
  Excel Online, Power Apps, Botão de fluxo).

| # | Fluxo | Gatilho | Para quê |
|---|---|---|---|
| 1 | SST – Ler painel | Power Apps (V2) | Devolve `painel.json` ao app |
| 2 | SST – Enviar comando | Power Apps (V2) | Grava um comando na `inbox/` |
| 3 | SST – Aprovações no Teams | Arquivo criado em `aprovacoes/` | Pede sua decisão no Teams/Outlook |
| 4 | SST – Respostas do Outlook | Novo e-mail | Entrega respostas de prospects ao agente |
| 5 | SST – Alertas | Recorrência (1 h) | Avisa no Teams sobre pausa, mensagens incertas e pendências |
| 6 | SST – Botão de pausa | Botão do celular | Liga/desliga o kill switch |
| 7 | SST – Importar leads do Excel | Manual/recorrência | Envia linhas de uma tabela Excel ao agente |
| 8 | Variante Premium | — | Mesmos fluxos usando o conector "SST Agent" |

---

## 1. SST – Ler painel

1. Gatilho **Power Apps (V2)** (*PowerApps (V2)*), sem entradas.
2. **Obter conteúdo do arquivo usando o caminho** (*Get file content using path*) — OneDrive for Business.
   Caminho: `/SST-Agent/export/painel.json`. Inferir tipo de conteúdo: **Não**.
3. **Responder a um aplicativo ou fluxo do PowerApps** (*Respond to a PowerApp or flow*):
   saída de **Texto** chamada `painel` com a expressão
   ```
   base64ToString(body('Obter_conteúdo_do_arquivo_usando_o_caminho')?['$content'])
   ```
   (Se o designer mostrar o conteúdo como texto direto, use simplesmente o conteúdo dinâmico *Conteúdo do arquivo*.)

## 2. SST – Enviar comando

1. Gatilho **Power Apps (V2)** com entrada de **Texto** `comando`.
2. **Inicializar variável** `token` (Cadeia de caracteres) = valor de `SST_BRIDGE_TOKEN` (ou vazio).
3. **Compor** (*Compose*) — Entradas (expressão):
   ```
   setProperty(json(triggerBody()['text']), 'token', variables('token'))
   ```
4. **Criar arquivo** (*Create file*) — OneDrive for Business:
   - Caminho da pasta: `/SST-Agent/inbox`
   - Nome do arquivo (expressão): `concat(outputs('Compor')?['id'], '.json')`
   - Conteúdo do arquivo (expressão): `string(outputs('Compor'))`
5. **Responder a um aplicativo ou fluxo do PowerApps**: Texto `status` = `enviado`.

O agente processa a pasta a cada minuto e grava o resultado em `/SST-Agent/outbox/<id>.result.json`.

## 3. SST – Aprovações no Teams (ou Outlook)

O agente cria **um arquivo por aprovação nova** em `/SST-Agent/aprovacoes/aprovacao-<id>.json` e o apaga
quando a decisão é registrada.

1. Gatilho **Quando um arquivo é criado** (*When a file is created*) — OneDrive for Business, pasta
   `/SST-Agent/aprovacoes`.
2. **Analisar JSON** (*Parse JSON*) — Conteúdo: *Conteúdo do arquivo*; esquema:
   ```json
   {"type":"object","properties":{"id":{"type":"integer"},"action":{"type":"string"},"level":{"type":"integer"},
    "subject_type":{"type":"string"},"subject_id":{"type":"integer"},"summary":{"type":"string"},
    "created_at":{"type":"string"},"titulo":{"type":"string"},"nivel_descricao":{"type":"string"}}}
   ```
3. **Iniciar e aguardar uma aprovação** (*Start and wait for an approval*):
   - Tipo: *Aprovar/Rejeitar – Primeiro a responder*
   - Título: `titulo` (conteúdo dinâmico)
   - Atribuído a: seu e-mail
   - Detalhes: `Ação: action · Nível level (nivel_descricao) · Criado em created_at`
     e o lembrete: *"Aprovar autoriza somente esta ação. Contratos, laudos e pagamentos nunca são executados pelo agente."*
4. **Inicializar variável** `token` (igual ao fluxo 2).
5. **Compor** — Entradas (cole como objeto JSON e insira os valores dinâmicos/expressões):
   ```json
   {
     "id": "@{guid()}",
     "type": "approval_decision",
     "approval_id": @{body('Analisar_JSON')?['id']},
     "approve": @{equals(outputs('Iniciar_e_aguardar_uma_aprovação')?['body/outcome'], 'Approve')},
     "by": "@{outputs('Iniciar_e_aguardar_uma_aprovação')?['body/responses'][0]['responder']['email']}",
     "note": "@{outputs('Iniciar_e_aguardar_uma_aprovação')?['body/responses'][0]['comments']}",
     "token": "@{variables('token')}"
   }
   ```
6. **Criar arquivo** — pasta `/SST-Agent/inbox`, nome `concat(outputs('Compor')?['id'], '.json')`,
   conteúdo `string(outputs('Compor'))`.
7. **Excluir arquivo** (*Delete file*) — o arquivo do gatilho (evita reprocessar se o fluxo for reexecutado).

Configurações do fluxo: tempo limite da ação de aprovação = 7 dias (`P7D`). Sem resposta, a aprovação
continua pendente no agente e aparece no relatório diário.

## 4. SST – Respostas do Outlook → agente

Use uma **caixa comercial dedicada** (ou uma pasta com regra do Outlook), para não enviar e-mails pessoais
ao agente (minimização LGPD).

1. Gatilho **Quando um novo email chegar (V3)** (*When a new email arrives (V3)*) — Office 365 Outlook,
   Pasta: `Entrada` (ou a pasta da regra), Incluir anexos: Não.
2. **Condição** (opcional): `Assunto` *contém* `Re:` **ou** `De` termina com um domínio de lead.
3. **Html para texto** (*Html to text*) — Conteúdo: *Corpo*.
4. **Compor**:
   ```json
   {
     "id": "@{guid()}",
     "type": "inbound_message",
     "from": "@{triggerOutputs()?['body/from']}",
     "subject": "@{triggerOutputs()?['body/subject']}",
     "body": "@{body('Html_para_texto')}",
     "message_id": "@{triggerOutputs()?['body/internetMessageId']}",
     "token": "@{variables('token')}"
   }
   ```
   (Inicialize a variável `token` antes, como no fluxo 2.)
5. **Criar arquivo** na `inbox/`, como nos fluxos anteriores.

O agente classifica (interesse, pergunta, negativa, descadastro, endereço inválido), cancela follow-ups,
atualiza o pipeline e prepara a resposta. Repetições do mesmo e-mail são ignoradas (`message_id`).
Com este fluxo ativo, o IMAP do `.env` é dispensável.

## 5. SST – Alertas

1. **Recorrência** a cada 1 hora.
2. **Obter conteúdo do arquivo usando o caminho**: `/SST-Agent/export/painel.json`.
3. **Analisar JSON** com o esquema mínimo:
   ```json
   {"type":"object","properties":{"kill_switch":{"type":"object","properties":{"ativo":{"type":"boolean"},
    "motivo":{"type":"string"}}},"mensagens_incertas":{"type":"integer"},"aprovacoes":{"type":"array"},
    "integracoes_pendentes":{"type":"array"},"gerado_em":{"type":"string"}}}
   ```
4. **Condição** (qualquer uma verdadeira):
   - `mensagens_incertas` maior que 0
   - `length(body('Analisar_JSON')?['aprovacoes'])` maior que 0
   - `kill_switch.ativo` igual a `true`
   - `gerado_em` mais antigo que 3 horas:
     `less(body('Analisar_JSON')?['gerado_em'], addHours(utcNow(), -3))` → indica agente parado.
5. **Se sim:** **Postar mensagem em um chat ou canal** (*Post message in a chat or channel*) — Teams, para você:
   ```
   SST Agent — atenção
   Aprovações pendentes: @{length(body('Analisar_JSON')?['aprovacoes'])}
   Mensagens incertas: @{body('Analisar_JSON')?['mensagens_incertas']}
   Envios pausados: @{body('Analisar_JSON')?['kill_switch']?['ativo']}
   Atualizado em: @{body('Analisar_JSON')?['gerado_em']}
   ```

## 6. SST – Botão de pausa (celular)

1. Gatilho **Disparar um fluxo manualmente** (*Manually trigger a flow*) com entrada **Sim/Não** `pausar`
   e Texto `motivo`.
2. **Compor**:
   ```json
   {"id": "@{guid()}", "type": "kill_switch", "on": @{triggerBody()['boolean']},
    "reason": "@{triggerBody()['text']}", "by": "@{triggerOutputs()['headers']['x-ms-user-email']}",
    "token": "@{variables('token')}"}
   ```
3. **Criar arquivo** na `inbox/`. No app Power Automate do celular, o fluxo aparece em **Botões**.

## 7. SST – Importar leads do Excel

Planilha `SST-Agent/Leads.xlsx` com uma **tabela** `Leads` e as colunas de `examples/leads_template.csv`
(`name, website, segment, city, state, contact_email, contact_type, source_url, source_description,
legal_basis, facts`). Toda linha precisa de `source_url` ou `source_description`.

1. **Disparar manualmente** (ou Recorrência diária).
2. **Listar linhas presentes em uma tabela** (*List rows present in a table*) — Excel Online (Business).
3. **Selecionar** (*Select*) — De: `value`; mapeamento no modo texto:
   ```
   {"name": item()?['name'], "website": item()?['website'], "segment": item()?['segment'],
    "city": item()?['city'], "state": item()?['state'], "contact_email": item()?['contact_email'],
    "contact_type": item()?['contact_type'], "source_url": item()?['source_url'],
    "source_description": item()?['source_description'], "legal_basis": item()?['legal_basis'],
    "facts": item()?['facts']}
   ```
4. **Compor**: `{"id": "@{guid()}", "type": "leads_import", "rows": @{body('Selecionar')}, "by": "excel", "token": "@{variables('token')}"}`
5. **Criar arquivo** na `inbox/`. Duplicatas (CNPJ, domínio, e-mail) são mescladas pelo agente.

## 8. Variante Premium (conector "SST Agent")

Troque a gravação de arquivo pelas ações do conector:

| Fluxo | Ação do conector |
|---|---|
| 1 | `ObterPainel` → responder ao Power Apps com `body` |
| 2/3 | `DecidirAprovacao` (`approval_id`, `approve`, `note`, `by`) |
| 3 | gatilho **Recorrência 10 min** + `ListarAprovacoes` + controle de já notificadas (ou mantenha o gatilho de arquivo) |
| 4 | `RegistrarResposta` |
| 6 | `KillSwitch` |
| 7 | `ImportarLeads` (`rows` = saída do *Selecionar*) |

A resposta é imediata; o restante das regras (níveis, aprovações, portão de envio) é o mesmo.
