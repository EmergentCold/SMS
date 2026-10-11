# Workflow — Qualificação (0–100)

**Módulo:** `src/crm/scoring.py`. **Job:** `qualify` (dias úteis 08:15). **Nível:** 1.

| Critério | Pontos | Como é calculado |
|---|---|---|
| Adequação do setor | 0–25 | `services.json → segments.<seg>.fit` |
| Potencial recorrente | 0–20 | `segments.<seg>.recurring` + ajuste por porte (`size_recurring_adjust`) |
| Evidência pública de demanda | 0–20 | 7 pontos por **FATO** com fonte e tag de demanda (hipóteses não pontuam) |
| Compatibilidade com competências | 0–15 | fração dos serviços do segmento que o proprietário pode ofertar sem validação extra |
| Canal comercial legítimo | 0–10 | corporativo genérico/inbound/indicação 10 · nominal 8 · só telefone 5 · nenhum/suprimido 0 |
| Viabilidade geográfica | 0–10 | Guarulhos/SP capital 10 · RMSP 8 · interior SP 5 · outro estado 2 |

| Faixa | Classe | Ação |
|---|---|---|
| 80–100 | alta | preparar contato inicial |
| 60–79 | média | preparar contato inicial |
| 40–59 | pesquisa adicional | buscar evidências/canal |
| < 40 | observação | manter ou descartar |

## Transições
- `PESQUISADO → QUALIFICADO` quando pontuação ≥ `outreach.limits.min_score_for_contact` (60). Evidência: `score`.
- `QUALIFICADO → CONTATO_AUTORIZADO` quando existe canal ativo, base legal registrada e não suprimido.
  Evidência: `base_legal`.
- Reavaliação abaixo do limite devolve a `PESQUISADO`.

A pontuação indica potencial comercial; **não** comprova infração nem necessidade técnica.
