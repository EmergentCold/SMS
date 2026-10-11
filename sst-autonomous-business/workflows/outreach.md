# Workflow — Prospecção (contato inicial)

**Módulos:** `src/outreach/sender.py`, `composer.py`; modelo `templates/first_contact.md`.
**Job:** `outreach` (de hora em hora, 09–17h, dias úteis). **Ação:** `send_first_contact` (nível 2).

## Passos
1. Prepara mensagem para leads `CONTATO_AUTORIZADO` (maior pontuação primeiro), com chave idempotente
   `lead:<id>:seq:0` — nunca duas mensagens iniciais para o mesmo lead.
2. Portão de envio (ordem): estado do lead → base legal → supressão (e-mail e domínio) → e-mail válido →
   filtro de conteúdo → identidade do remetente → autonomia/aprovação → kill switch →
   `EXTERNAL_SENDING_ENABLED` → horário comercial → limites (dia, hora, 1º contatos/dia, domínio 30 dias,
   1 contato por empresa) → canal configurado → reserva `ENVIANDO` → envio.
3. Com `send_first_contact.enabled=false` (padrão), a mensagem vai para a fila: `approvals list/approve/reject`.
4. Enviada: lead → `CONTATADO` (evidência: id da mensagem) e follow-ups agendados.
5. Canal sem credenciais: mensagem `PENDENTE_INTEGRACAO` + pendência registrada; nada é simulado.

## Revisão humana recomendada antes de liberar o nível 2
- Ler 10 mensagens aprovadas manualmente; conferir tom, origem do contato e segmento.
- Só então `config/autonomy.json → send_first_contact.enabled = true`.
