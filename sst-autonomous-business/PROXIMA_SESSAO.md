# Roteiro para a sessão do Claude no computador do proprietário

> Cole na sessão local (Claude Desktop ou `claude remote-control`, aberta na pasta do repositório):
> **"Leia sst-autonomous-business/PROXIMA_SESSAO.md e execute o roteiro comigo."**

Contexto: o SST Autonomous Business Agent já está implementado e testado (ver `STATUS.md`). A sessão na nuvem
não alcança o computador, a conta Microsoft nem os sites das empresas; esta sessão local alcança. O proprietário
escolheu: **operar a partir do PC** e **e-mail de domínio próprio**.

## Regras para o Claude desta sessão

- Leia `CLAUDE.md` (regras invioláveis) antes de agir. Peça confirmação antes de instalar programas, alterar
  o Agendador de Tarefas, gravar credenciais ou habilitar envio externo.
- Senhas e tokens: o proprietário digita direto no `.env`/conexões — não peça para colá-los no chat.
- Não invente dados: nome, e-mail, preços e capacidade vêm do proprietário; contatos só do **site oficial**
  de cada empresa, com URL e data.
- Nada de envio em massa: o primeiro contato continua passando por aprovação (`send_first_contact` desligado)
  até o proprietário revisar as 10 primeiras mensagens.

## Roteiro

### 1. Instalação (10–15 min)
1. Se o repositório ainda não estiver no PC: rodar o instalador
   `powershell -NoProfile -ExecutionPolicy Bypass -File sst-autonomous-business\instalar\instalar_windows.ps1`
   (ou o comando `irm ... | instalar_sst.ps1` do README). Responder **sim** a "Microsoft 365 / Power Automate".
2. Conferir: `python -m src.main status` e `python -m src.main integrations --offline`.
   Esperado: agendador ativo (tarefa "SST Agent"), `identidade_remetente` ok, ponte no OneDrive criada.

### 2. Identidade e oferta (com o proprietário)
1. `python instalar\configurar_identidade.py --nome "..." --marca "..." --email contato@dominio --telefone "..." --horas-semana N --contratos-max N`
2. Registro profissional: só preencher `owner.registration_number` e `registration_verified: true` se o
   proprietário confirmar o número.
3. Preços: preencher `config/pricing.json` pelo menos para o serviço **A (Diagnóstico)** — `list_price`,
   `min_price`, `max_discount_pct`, `status: "aprovado"` — e `defaults.payment_terms`. Valores do proprietário.
4. Revisar com ele `templates/first_contact.md` e `config/outreach.json → segment_hooks` (tom e texto).

### 3. Microsoft 365 (com o proprietário logado no navegador)
Seguir `powerplatform/power-automate/FLUXOS.md`, nesta ordem:
1. **Fluxo 9 – Enviar e-mails** (Outlook da caixa comercial).
2. **Fluxo 4 – Respostas do Outlook** (substitui IMAP).
3. **Fluxo 3 – Aprovações no Teams**.
4. Fluxos 1 e 2 (para o Power Apps) e 6 (botão de pausa).
Teste do fluxo 9: com `EXTERNAL_SENDING_ENABLED=true` e o kill switch desligado, aprovar **uma** mensagem
de teste para o próprio e-mail do proprietário (importar um lead de teste com o e-mail dele e
`legal_basis=consentimento`) e confirmar a chegada + arquivo em `envios/confirmados/`.

### 4. Primeiros leads reais
1. Importar o CSV entregue na sessão da nuvem (`leads_pesquisa_2026-10-12.csv`: Condottalog, TriMais,
   Speed Cargas, BBM, Rodovisa, JMS, Comfrio — **sem contatos**) ou refazer a pesquisa.
2. Para cada empresa: abrir o **site oficial**, confirmar que é a empresa certa, e registrar **apenas** canal
   comercial genérico publicado (contato@, comercial@, formulário) com a URL da página:
   reimportar uma linha com `website`, `contact_email`, `contact_type=generic_corporate`, `source_url`.
   Alternativa automática: `python -m src.main job research` com `BRAVE_SEARCH_API_KEY` (lê os sites e
   respeita robots.txt).
3. `python -m src.main job qualify` → `python -m src.main job outreach` → aprovações aparecem no Teams.
4. Ampliar a lista: transportadoras, CDs, armazéns e manutenção em Guarulhos, São Paulo e RMSP (ver
   `config/research.json`), priorizando PMEs.

### 5. Operação contínua
- `EXTERNAL_SENDING_ENABLED=true` somente após o teste do fluxo 9.
- O agendador cuida de qualificação, follow-ups (D3/D7/D14), relatórios (18:30) e da ponte (1 min).
- Power BI: `powerplatform/power-bi/MODELO.md`. Power Apps: `powerplatform/power-apps/APP.md`.
- Revisão semanal: `reports/semanal-*.md`; descadastros > 2% → reduzir volume e revisar texto.

## Estado deixado pela sessão na nuvem (2026-10-12)
- 109 testes Python + 4 JS + teste no navegador passando; ensaio do instalador concluído (ver `STATUS.md`).
- Canal de envio pelo Power Automate implementado (`EMAIL_CHANNEL=power_automate`), pois o SMTP com senha do
  Microsoft 365 passa a ser desligado por padrão a partir de dezembro de 2026.
- Pendências do proprietário: identidade, preços, criação dos fluxos, conferência dos contatos nos sites.
