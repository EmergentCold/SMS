# Conformidade legal e proteção de dados

> Documento operacional, não é parecer jurídico. Revise com assessoria jurídica antes de ativar envios.
> Última revisão desta página: 2026-10-11.

## LGPD (Lei nº 13.709/2018)

| Tema | Como o sistema trata |
|---|---|
| Origem e finalidade | Toda empresa/contato/evidência tem `data_sources` (tipo, URL, data, finalidade `prospeccao_b2b_sst`). |
| Base legal | Registrada por contato (`legitimo_interesse`, `consentimento`, `solicitacao_titular`). Sem base → não envia. |
| Legítimo interesse | Contato B2B por canal profissional. Teste de balanceamento: `lgpd.lia_template()`; guia da ANPD (fev/2024). |
| Minimização | Preferência por canais corporativos genéricos; nome/cargo só quando necessário; sem dados sensíveis. |
| Dados sensíveis | Não coletados. Legítimo interesse não se aplica a dados sensíveis. |
| Oposição/descadastro | Palavra-chave na resposta ou comando `lgpd object` → supressão imediata + cancelamento de tarefas. |
| Acesso | `lgpd export <email>` gera tudo o que existe sobre o titular. |
| Correção | `lgpd correct <email> <campo> <valor>`. |
| Eliminação | `lgpd delete <email>`: anonimiza; mantém apenas hash SHA-256 na supressão (para não recontatar). |
| Retenção | `config/business.json → retention`; job semanal `retention`. |
| Segurança | Segredos só no `.env`/ambiente; logs mascarados; `.env` e `data/` fora do Git. |
| Registro | Pedidos de titulares em `dsr_requests`; ações em `audit_events`. |

## Comunicações comerciais

- Não há lei federal específica de spam no Brasil; aplicam-se LGPD, Código de Defesa do Consumidor e a
  autorregulação de e-mail marketing (CAPEM): identificação do remetente, opt-out funcional e respeito ao pedido.
- Regras implementadas: identificação, origem do contato, descadastro em toda mensagem, cabeçalho
  `List-Unsubscribe`, limites diários/por hora, 1 contato inicial por empresa, intervalo por domínio (30 dias),
  horário comercial, sequência finita (encerra no dia 14) e parada imediata em resposta.
- WhatsApp: somente WhatsApp Business Platform (API oficial) com opt-in e modelos aprovados — não implementado.
- LinkedIn e redes sociais: sem automação (termos das plataformas).
- Não comprar nem usar bases obtidas ilegalmente; provedor B2B só com licença que permita prospecção.
- Pesquisa web: respeita `robots.txt`, identifica-se no User-Agent, não contorna CAPTCHA/login/bloqueio (401/403/429
  encerra a leitura do domínio).

## Limites profissionais (SST)

- O sistema não substitui profissional legalmente habilitado e não decide questões que dependam de inspeção,
  medições, avaliação de riscos ou responsabilidade técnica.
- Laudos, projetos com ART, PCMSO e declarações de conformidade estão fora do escopo automático (nível 3).
- Emergências, acidentes graves ou risco grave e iminente: o agente **não** orienta; encaminha ao proprietário
  e, quando for o caso, aos serviços de emergência.
- A pontuação de leads não comprova infração; nenhuma empresa é chamada de irregular.

## Contratos e dinheiro

- O agente não assina contratos, não aceita obrigações não previstas, não concede desconto acima do limite,
  não realiza pagamentos nem altera dados bancários (nível 3, `human_only`).
