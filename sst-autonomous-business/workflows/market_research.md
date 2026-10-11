# Workflow — Pesquisa de mercado

**Objetivo:** decidir onde prospectar (segmentos × cidades) e com qual mensagem, a partir de dados, não de palpites.

**Executor:** proprietário + agente (nível 1). **Frequência:** mensal e após cada relatório semanal.

## Entradas
- `config/research.json` (cidades iniciais: Guarulhos, São Paulo, Barueri, Cajamar, Osasco, Itaquaquecetuba, Arujá).
- `config/services.json → segments` (adequação e recorrência por segmento).
- Relatório semanal (`reports/semanal-*.md`): respostas e conversão por segmento.
- `knowledge/official_sources.md` (temas normativos atuais, ex.: NR-1 / riscos psicossociais).

## Passos
1. Ler o relatório semanal e listar os segmentos com maior taxa de resposta positiva.
2. Revisar `segments.*.fit/recurring` se os resultados contradisserem as hipóteses iniciais
   (alterar segmentos ou criar novos é ação `create_segment`, nível 2 → aprovação por padrão).
3. Ajustar `queries` e `start_region.cities` para a próxima rodada.
4. Atualizar `segment_hooks` (mensagens por segmento) — sem alegações proibidas.
5. Registrar a decisão e a data no histórico do Git (commit da configuração).

## Saídas
- Configuração revisada; nenhuma empresa é contatada nesta etapa.

## Regras
- Fatos com fonte; hipóteses marcadas como hipótese. Nada de "o setor X é irregular".
