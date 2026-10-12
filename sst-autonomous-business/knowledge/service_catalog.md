# Catálogo de serviços

A fonte de verdade é `config/services.json` (escopo) e `config/pricing.json` (preço). Este documento explica
como cada serviço deve ser vendido. **Nenhum preço está aprovado**: todos estão como `preco_pendente`.

| Cód. | Serviço | Recorrente | Validação profissional | Prazo |
|---|---|---|---|---|
| A | Diagnóstico preliminar de SST | não (porta de entrada) | não | 10 dias |
| B | Inspeções e relatórios de segurança | sim | não | 5 dias |
| C | DDS, integrações e treinamentos | sim | não (treinamentos normativos dependem da NR) | 7 dias |
| D | Gestão documental de terceiros | sim | não | 7 dias |
| E | Auditorias internas e planos de ação | não | não | 15 dias |
| F | Consultoria para adequação às NRs | não | itens com ART exigem engenheiro | 30 dias |
| G | Gestão de indicadores e planos de prevenção | sim | não | 10 dias |
| H | Elaboração/revisão de documentos técnicos | não | **sim — sempre nível 3** | 20 dias |
| I | Programa mensal de suporte consultivo | sim | não | 7 dias |

### Soluções digitais (atendimento remoto em todo o Brasil)

| Cód. | Serviço | Recorrente | Prazo |
|---|---|---|---|
| J | Sistema web sob medida para SST | não | 20 dias |
| K | Planilha inteligente de controle de SST | não | 5 dias |
| L | Painel Power BI e automações (Power Automate/Power Apps) | não | 15 dias |
| M | Apresentações profissionais de SST | não | 4 dias |
| N | Crachás e etiquetas com QR Code | não | 7 dias |
| O | Jogo ou quiz educativo de segurança | não | 7 dias |
| P | Melhoria de processos de SST (híbrido) | não | 15 dias |

Público adicional: **consultorias, clínicas e SESMTs** de todo o Brasil (segmento `consultoria_sst`), que compram
ferramentas digitais para usar com os próprios clientes.

Para cada serviço, `config/services.json` documenta: cliente ideal, problema, entregáveis, exclusões, prazo,
informações necessárias, requisitos profissionais, recorrência e critérios de aceite.
Custos operacionais, preço mínimo, margem e desconto máximo ficam em `config/pricing.json`.

## Estratégia de oferta

1. **Entrada:** A (diagnóstico) — baixo risco para o cliente, gera o plano de ação.
2. **Conversão para recorrência:** I (suporte mensal), com B, C, D ou G embutidos conforme o plano.
3. **Projetos pontuais:** E e F quando o diagnóstico mostrar demanda (com aceite do cliente).

## Como definir preços (pendência do proprietário)

1. Calcule custo operacional por serviço: horas × valor-hora desejado + deslocamento + materiais + impostos.
2. Pesquise referências públicas (sites de consultorias que publicam faixas, tabelas de sindicatos/associações,
   propostas recebidas por conhecidos) e **registre a fonte e a data** em `reference_sources`.
3. Defina `min_price` (piso que cobre custo + margem mínima) e `list_price` (preço de tabela).
4. Defina `max_discount_pct` (o agente negocia até esse limite somente se `negotiate_discount` estiver habilitado).
5. Mude `status` para `"aprovado"`.

Até lá, propostas são geradas como **RASCUNHO — PREÇO PENDENTE** e o envio é bloqueado.
