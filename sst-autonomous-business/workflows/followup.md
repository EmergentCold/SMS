# Workflow — Follow-up

**Módulo:** `src/outreach/followup.py`; modelo `templates/followup.md`.
**Job:** `followups` (dias úteis, de hora em hora). **Ação:** `send_followup` (nível 1 — só existe após um
contato inicial autorizado e enviado).

Sequência padrão (`config/outreach.json → followup_sequence`): dia 0 contato · dia 3 · dia 7 · dia 14 encerramento.
Sete dias após a última etapa sem resposta, o lead vai para `PERDIDO` (evidência `sem_resposta`).

## Verificações antes de cada envio
1. Contato inicial consta como `ENVIADA`.
2. Nenhuma resposta recebida desde o contato inicial.
3. Lead ainda em `CONTATADO`.
4. Destinatário não suprimido; base legal ativa; contato não inválido.
5. Canal de e-mail ainda habilitado na configuração.
6. Etapa anterior enviada (senão adia 2 h); chave única `lead:<id>:seq:<n>` impede duplicidade.

## Interrupção imediata
Resposta (qualquer), descadastro, negativa, endereço inválido (bounce), oposição LGPD ou ausência de base
legal cancelam todas as tarefas e mensagens não enviadas da sequência.

## Interessados
Resposta positiva não segue a sequência automática: gera rascunho contextual (`templates/reply.md`,
ação `send_reply`, nível 2) e a próxima ação "propor reunião".
