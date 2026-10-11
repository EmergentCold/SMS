# Workflow — Propostas

**Módulo:** `src/proposals/generator.py`; modelo `templates/proposal.md`. Arquivos em `data/proposals/`.

```bash
python -m src.main proposal create <lead_id> A [--discount 5]
python -m src.main proposal send <proposal_id>
python -m src.main proposal outcome <proposal_id> aceita|recusada
```

## Regras
| Situação | Resultado |
|---|---|
| Preço não aprovado em `pricing.json` | `PRECO_PENDENTE` — rascunho, envio bloqueado |
| Preço aprovado, sem desconto | `PRONTA` |
| Desconto ≤ `max_discount_pct` e preço ≥ `min_price` | aprovação `negotiate_discount` (nível 2) |
| Desconto acima do limite ou preço < mínimo | aprovação `discount_above_limit` (nível 3) |
| Serviço com `requires_professional_validation` (H) | aprovação `propose_restricted_service` (nível 3) |
| Lead não demonstrou interesse | envio bloqueado |
| Contratos ativos ≥ `capacity.max_active_contracts` | envio bloqueado |

O envio (`send_proposal`) é nível 2 — por padrão passa pela fila de aprovação.
Enviada → lead `PROPOSTA`. Retorno do cliente → `NEGOCIACAO`. Contrato **assinado pelo proprietário** e
registrado com `contract --confirm-signed` → `GANHO`.

## Seções obrigatórias
Partes · objetivo · escopo/entregáveis · cronograma · premissas · exclusões · responsabilidades · preço ·
pagamento · validade · critérios de aceite · visita técnica/validação profissional.
