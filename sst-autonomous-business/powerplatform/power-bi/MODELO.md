# Relatório Power BI — SST Agent

Tempo de montagem: ~30 minutos no Power BI Desktop. Nada aqui contém credenciais.

## 1. Dados

1. Gere os arquivos: `python -m src.main powerbi-export` (ou deixe o `daemon` exportar a cada hora).
   Saída em `<POWERPLATFORM_DIR>/export/`:

| Arquivo | Grão | Chave |
|---|---|---|
| `dim_empresa.csv` | empresa | `empresa_id` |
| `fato_lead.csv` | lead (1 por empresa) | `lead_id` → `empresa_id` |
| `fato_pipeline_eventos.csv` | mudança de estado | `lead_id` |
| `fato_mensagens.csv` | mensagem (sem assunto/corpo) | `lead_id` |
| `fato_propostas.csv` | proposta/versão | `lead_id` |
| `fato_contratos.csv` | contrato | `contrato_id` → `lead_id` |
| `fato_financeiro.csv` | lançamento | `contrato_id` |
| `fato_reunioes.csv` | reunião | `lead_id` |
| `aprovacoes.csv` | pedido de aprovação | — |
| `custos_ferramentas.csv` | integração × dia | `dia` |
| `contatos_canal.csv` | canal (e-mail mascarado) | `empresa_id` |
| `kpis.csv` | indicador × valor (inclui receita potencial) | — |

2. No Power BI Desktop: **Transformar dados → Gerenciar parâmetros** → crie `PastaDados`; depois crie as
   consultas de [`consultas.pq`](consultas.pq) (uma por bloco, com o nome indicado).
3. **Exibição → Temas → Procurar temas** → [`tema-sst.json`](tema-sst.json).
4. Crie a tabela `Calendario` e as medidas de [`medidas.dax`](medidas.dax).

## 2. Relacionamentos (Exibição de modelo)

| De (1) | Para (*) | Direção |
|---|---|---|
| `dim_empresa[empresa_id]` | `fato_lead[empresa_id]` | única |
| `dim_empresa[empresa_id]` | `contatos_canal[empresa_id]` | única |
| `fato_lead[lead_id]` | `fato_mensagens[lead_id]` | única |
| `fato_lead[lead_id]` | `fato_propostas[lead_id]` | única |
| `fato_lead[lead_id]` | `fato_contratos[lead_id]` | única |
| `fato_lead[lead_id]` | `fato_reunioes[lead_id]` | única |
| `fato_lead[lead_id]` | `fato_pipeline_eventos[lead_id]` | única |
| `fato_contratos[contrato_id]` | `fato_financeiro[contrato_id]` | única |
| `Calendario[Date]` | `fato_mensagens[dia]` | única |
| `Calendario[Date]` | `fato_financeiro[dia]` | única (inativa se gerar ambiguidade) |
| `Calendario[Date]` | `fato_propostas[dia]` | única (inativa) |
| `Calendario[Date]` | `custos_ferramentas[dia]` | única |

Marque `Calendario` como tabela de datas. Em `fato_lead`, classifique `status_rotulo` por `ordem_funil`.

## 3. Páginas sugeridas

**Visão geral**
- Cartões: Leads Qualificados, Mensagens Enviadas, Taxa de Resposta, Reuniões, Propostas Enviadas,
  Contratos Fechados, Aprovações Pendentes, Mensagens Incertas (formatação condicional vermelha se > 0).
- Gráfico de funil: `fato_lead[status_rotulo]` × `Leads` (filtrar PERDIDO/DESCADASTRADO/BLOQUEADO).
- Colunas: Mensagens Enviadas e Respostas Positivas por `Calendario[Semana]`.

**Segmentos**
- Barras: Leads, Taxa de Resposta e Conversão por `dim_empresa[segmento]`.
- Mapa/tabela por `dim_empresa[cidade]`. Segmentação por `porte`, `prioridade`.

**Receita e custos** (categorias lado a lado, nunca somadas)
- Tabela com uma linha por categoria: 1. Potencial (de `kpis.csv`, indicador
  `receita.1_potencial_estimada`), 2. Propostas Emitidas, 3. Contratada, 4. Recebida, A Receber, MRR.
- Colunas mensais de Receita 4 - Recebida vs Despesas Realizadas + Custo Ferramentas; linha de Margem Realizada.

**Operação e conformidade**
- Tabela de `aprovacoes` pendentes; Descadastros e Taxa de Descadastro (alerta acima de 2%).
- Linha do tempo de `fato_pipeline_eventos` (quem mudou, evidência, motivo).

## 4. Publicação e atualização

| Fonte | Atualização no Power BI Service |
|---|---|
| `fnLerCsvSharePoint` (OneDrive for Business/SharePoint) | agendada, **sem gateway**; credencial OAuth2 da sua conta |
| `fnLerCsv` (pasta local) | exige **gateway de dados local** no computador do agente |
| Web (`/api/powerbi/<tabela>?format=csv`) | só com API publicada por HTTPS; o Service não suporta bem cabeçalho personalizado em atualização agendada — prefira os CSVs |

Agende a atualização para alguns minutos após o job `powerbi_export` (padrão: minuto 05 de cada hora).

## 5. Privacidade

O modelo não recebe corpo de mensagem, telefone nem nome de pessoa. Não publique na web ("Publicar na Web")
e compartilhe só com quem decide pelo negócio. Empresas de simulação (`simulacao = 1`) são filtradas na consulta.
