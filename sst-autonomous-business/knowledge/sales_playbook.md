# Playbook comercial

## Público prioritário

PMEs de São Paulo (Guarulhos, capital e região metropolitana) sem estrutura robusta de SST, em especial:
transportadoras, CDs, operadores logísticos, armazéns, indústrias, manutenção, construção, condomínios
empresariais, terceirizadas e prestadores de serviços industriais.

## Ordem de prioridade de contato

1. Indicações e contatos que já autorizaram comunicação (`referral_authorized`, `inbound_request`).
2. Empresas com canal comercial público e apropriado (`generic_corporate`: contato@, comercial@ no site oficial).
3. Leads de fontes empresariais autorizadas (CSV do proprietário, provedor B2B licenciado).
4. Respostas de interessados.
5. Formulários e solicitações comerciais.

## Princípios das mensagens

- Curta (≤ 150 palavras), específica do segmento, remetente identificado com nome e função.
- Dizer onde o contato foi obtido. Oferecer descadastro em toda mensagem.
- Proibido: alegar auditoria/visita que não ocorreu, apontar irregularidade sem evidência, alegar indicação,
  parceria ou relação anterior inexistente, prometer conformidade, usar medo de multa como argumento.
  (Bloqueado automaticamente por `config/outreach.json → forbidden_claims`.)

## Qualificação em conversa (perguntas)

1. Quantos colaboradores próprios e terceiros? Quantas unidades?
2. Quem cuida de SST hoje (interno, SESMT, consultoria, ninguém)?
3. Existem exigências de clientes/contratantes (documentação, auditorias, homologação)?
4. Quais atividades críticas (altura, espaço confinado, máquinas, empilhadeiras, eletricidade)?
5. O que motivou o interesse agora? Há prazo?

## Objeções frequentes

| Objeção | Resposta orientativa |
|---|---|
| "Já temos SST" | Perguntar o que funciona e onde há sobrecarga; oferecer apoio pontual (inspeções, terceiros, DDS). |
| "Está caro" | Reduzir escopo (diagnóstico enxuto) — nunca baixar abaixo de `min_price` sem aprovação. |
| "Não é o momento" | Encerrar com cordialidade; o lead vai para PERDIDO e não recebe novos follow-ups. |
| "Como conseguiu meu contato?" | Informar a origem registrada (FAQ `quem_e`) e oferecer descadastro. |
| "Vocês emitem laudo?" | Explicar o limite de habilitação; se houver parceiro formal, encaminhar ao proprietário (nível 3). |

## Do interesse ao contrato

RESPONDEU → reunião (convite .ics) → diagnóstico/visita → proposta (preço aprovado) → negociação dentro do
limite → contrato assinado **pelo proprietário** → registro com `contract` → lançamentos com `finance`.
