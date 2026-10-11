# Workflow — Relatórios e melhoria contínua

**Módulos:** `src/analytics/metrics.py`, `reports.py`. **Jobs:** `daily_report` (18:30 dias úteis),
`weekly_report` (sexta 17:00). Saída: `reports/diario-AAAA-MM-DD.md|json`, `reports/semanal-*.md|json`.

## Indicadores
Empresas pesquisadas · leads qualificados · leads por segmento · contatos enviados · taxa de entrega ·
taxa de resposta · respostas positivas · descadastros/reclamações · reuniões · propostas · conversão ·
contratos · receita (4 categorias separadas) · custos de ferramentas · margem · MRR · tempo médio até a venda.

## Receita — nunca somar categorias
1. **Potencial**: preço de tabela aprovado × leads abertos (estimativa).
2. **Propostas emitidas**: valor das propostas enviadas.
3. **Contratada**: contratos assinados registrados pelo proprietário.
4. **Recebida**: lançamentos `RECEITA` com status `REALIZADO` e data de recebimento.

## Revisão semanal (proprietário, 20 min)
1. Pendências de aprovação e integrações pendentes.
2. Mensagens `INCERTA` (conferir caixa de saída antes de qualquer reenvio).
3. Segmentos com melhor resposta → ajustar `research.json`/`segment_hooks` (ver market_research.md).
4. Descadastros/reclamações acima de 2% dos envios → reduzir volume e revisar mensagens.
