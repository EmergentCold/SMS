# Plano gratuito — operar sem gastar nada

Decisão de 12/10/2026: começar **sem custo**. O domínio **tavarezsst.com.br** fica reservado como meta: registrar
(~R$ 40/ano) assim que entrar o primeiro pagamento de cliente.

## O que funciona de graça

| Parte | Como fica no plano gratuito | Custo |
|---|---|---|
| Motor do agente (Python) | igual: pesquisa por CSV, qualificação, mensagens, follow-ups, propostas, relatórios | R$ 0 |
| E-mail | **Gmail gratuito** com senha de app: envia (SMTP) e lê respostas (IMAP) | R$ 0 |
| Aprovações | **painel web** (`http://127.0.0.1:8765`) em vez do Teams | R$ 0 |
| Power BI | **Power BI Desktop** (gratuito) lendo os CSVs da pasta local `data/powerplatform/export` (`fnLerCsv`) | R$ 0 |
| Busca automática de empresas | opcional: Brave Search API dá ~US$ 5/mês de crédito (~1.000 buscas), mas **pede cartão**; o agente para em **800 buscas/mês** (`config/research.json → max_search_calls_per_month`) para nunca gerar cobrança. Sem cartão: lista CSV + pesquisa nas sessões com o Claude | R$ 0 |

**Fica para depois** (exigem Microsoft 365 pago): Power Automate na nuvem, Power Apps, Teams e o fluxo de envio
pelo Outlook. Os guias em `powerplatform/` continuam válidos para quando assinar.

## Passo a passo do Gmail (10 min, no seu celular ou PC)

1. Crie um Gmail **só para o negócio**, por exemplo `tavarezsst@gmail.com` (se estiver ocupado: `tavarez.sst@`,
   `luantavarez.sst@`). Não use o seu e-mail pessoal: assim o histórico comercial fica separado.
2. Ative a **verificação em duas etapas**: myaccount.google.com → Segurança.
3. Crie uma **senha de app**: myaccount.google.com → Segurança → Senhas de app → nome "SST Agent".
   Guarde os 16 caracteres — eles vão **só** no instalador (pergunta oculta), nunca no chat.
4. Rode o instalador e responda **sim** em "Usar um Gmail GRATUITO". Ele grava `SMTP_*` e `IMAP_*` no `.env`,
   restringe o acesso ao arquivo e testa o login (sem enviar nada).
5. No passo 5 do instalador, informe o mesmo Gmail como e-mail comercial.

Configuração equivalente, se preferir editar o `.env` à mão:
```
EMAIL_CHANNEL=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURITY=starttls
SMTP_USER=tavarezsst@gmail.com
SMTP_PASSWORD=<senha de app, sem espaços>
SMTP_FROM=tavarezsst@gmail.com
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=tavarezsst@gmail.com
IMAP_PASSWORD=<a mesma senha de app>
```

O e-mail pessoal do Outlook.com **não serve** para envio automático: a Microsoft desligou o login por senha
(SMTP) nas contas pessoais.

## Cuidados com Gmail gratuito

- Limite do Gmail gratuito: cerca de 500 destinatários por dia (fontes de terceiros). O agente envia bem menos:
  **5 primeiros contatos/dia** nas 2 primeiras semanas (aquecimento), depois 10 e 15.
- Gmail pessoal enviando prospecção chama mais atenção dos filtros: mantenha mensagens curtas, sem anexos e
  sem links no primeiro contato (o modelo atual já segue isso), e responda rápido a quem responder.
- Se aparecer bloqueio de envio do Google, ative o kill switch (`python -m src.main kill-switch on`) e espere 24 h.

## Quando entrar o primeiro dinheiro (ordem sugerida)

1. Registrar **tavarezsst.com.br** (~R$ 40/ano) — `knowledge/dominio_e_email.md`.
2. E-mail com o domínio (Microsoft 365 Business Basic ou outro provedor) + SPF/DKIM/DMARC.
3. Trocar no agente: `python instalar\configurar_identidade.py --email contato@tavarezsst.com.br` e o `.env`.
4. Registrar as despesas no agente (`finance DESPESA ...`) para a margem ficar correta.
