# Integração com Microsoft Power Platform

O motor do agente continua em **Python** (pesquisa, qualificação, portão de envio, LGPD, pipeline). O Power
Platform vira a camada de operação do proprietário:

| Ferramenta | Papel | Pasta |
|---|---|---|
| **Power BI** | Painel gerencial: funil, conversão, receita (4 categorias), custos, segmentos | [`power-bi/`](power-bi/) |
| **Power Automate** | Aprovações no Teams/Outlook, respostas do Outlook → agente, alertas, botão de pausa, importação de leads do Excel | [`power-automate/`](power-automate/) |
| **Power Apps** | App de celular: aprovar/rejeitar, pausar envios, ver leads e KPIs, registrar respostas | [`power-apps/`](power-apps/) |
| **JavaScript** | Painel web servido pela API (`python -m src.main api`) | [`../web/`](../web/) |
| **Python** | Motor, agendador, API REST, exportação e ponte | [`../src/`](../src/) |

## Dois modos de conexão

```
MODO A — licença padrão do Microsoft 365 (recomendado para começar)

 Power Apps ──(fluxo)──► Power Automate ──► OneDrive: SST-Agent/inbox/*.json ──sincroniza──► Python
     ▲                                                                                         │
     └──(fluxo lê)── OneDrive: SST-Agent/export/painel.json ◄──sincroniza── Python (a cada minuto/hora)
 Power BI ◄── SharePoint/OneDrive: SST-Agent/export/*.csv
 Teams/Outlook ◄── Power Automate ◄── OneDrive: SST-Agent/aprovacoes/aprovacao-<id>.json

MODO B — Premium (Power Apps/Automate Premium)

 Power Apps / Power Automate ──conector personalizado (HTTPS + X-API-Key)──► túnel HTTPS ──► API Python
```

| | Modo A (arquivos) | Modo B (API) |
|---|---|---|
| Licença Power Platform | Padrão (incluída no Microsoft 365) | **Premium** (conectores personalizados e HTTP são premium) |
| Porta aberta na internet | nenhuma | sim, via túnel HTTPS (Cloudflare Tunnel) ou gateway de dados local |
| Latência de uma decisão | 1–3 min (sincronização do OneDrive + ciclo de 1 min) | imediata |
| Conectores usados | OneDrive for Business, Aprovações, Outlook, Teams, Excel Online, Power Apps | Conector personalizado "SST Agent" |

## Passo a passo — Modo A

1. **Pasta sincronizada.** No computador (ou servidor) que roda o agente, instale o OneDrive e crie
   `OneDrive - <empresa>/SST-Agent`. No `.env`:
   ```
   POWERPLATFORM_DIR=C:\Users\voce\OneDrive - Empresa\SST-Agent
   SST_BRIDGE_TOKEN=<texto aleatório longo>   # opcional, recomendado
   ```
2. **Primeira exportação:** `python -m src.main powerbi-export` cria `export/`, `inbox/`, `outbox/` e
   `aprovacoes/`. Com o `daemon` rodando, a ponte roda a cada minuto e a exportação a cada hora.
3. **Power Automate:** crie os fluxos de [`power-automate/FLUXOS.md`](power-automate/FLUXOS.md)
   (mínimo: 1 *SST – Ler painel*, 2 *SST – Enviar comando*, 3 *SST – Aprovações no Teams*).
4. **Power Apps:** monte o app seguindo [`power-apps/APP.md`](power-apps/APP.md).
5. **Power BI:** siga [`power-bi/MODELO.md`](power-bi/MODELO.md) (consultas M, medidas DAX, tema).

## Passo a passo — Modo B

1. `.env`: `SST_API_TOKEN=<≥24 caracteres aleatórios>`, `SST_API_PUBLIC_HOST=sst.seudominio.com.br`.
2. `python -m src.main api` (escuta em `127.0.0.1:8765`; painel web em `/`).
3. Publique por HTTPS **sem abrir porta no roteador**, por exemplo
   `cloudflared tunnel --url http://127.0.0.1:8765` (com domínio próprio e Cloudflare Access, se possível).
4. `python -m src.main openapi --host sst.seudominio.com.br --output powerplatform/custom-connector/apiDefinition.swagger.json`
5. Importe o conector: [`custom-connector/README.md`](custom-connector/README.md).

## Segurança

- Quem pode escrever em `SST-Agent/inbox` pode aprovar ações e pausar envios: **não compartilhe a pasta**;
  ative `SST_BRIDGE_TOKEN` e inclua o campo `token` nos fluxos.
- Comandos são idempotentes (`id`), validados e auditados (`audit_events`, ator `ponte:<email>` ou `api:<email>`).
- Ações `human_only` (assinar contrato, laudo, pagamento…) **nunca** são executadas, mesmo aprovadas.
- Exportações não contêm corpo de mensagem, telefone nem nome de pessoa; e-mails saem mascarados.
- A API exige token, compara em tempo constante, não devolve segredos em erros e escuta só em localhost.
- Os arquivos do Power Platform nesta pasta não contêm credenciais; conexões são criadas no seu tenant.

## O que foi testado aqui e o que não foi

| Item | Situação |
|---|---|
| API REST, ponte de arquivos, exportação CSV/JSON, especificação OpenAPI | testes automatizados (`tests/test_api.py`, `tests/test_powerplatform.py`) |
| Painel JavaScript | testes `node --test` e teste ponta a ponta no Chromium (`web/tests/e2e.mjs`) |
| Fluxos, app do Power Apps, relatório do Power BI | **não executados** — exigem o seu tenant Microsoft 365. Os guias usam conectores e funções documentados; nomes de ações podem variar com o idioma da interface. |
