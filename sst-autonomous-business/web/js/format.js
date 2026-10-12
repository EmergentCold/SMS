// Funções puras de formatação e cálculo (testadas com `node --test web/tests`).

export const PIPELINE_ORDER = [
  "PESQUISADO", "QUALIFICADO", "CONTATO_AUTORIZADO", "AGUARDANDO_APROVACAO", "CONTATADO", "RESPONDEU",
  "REUNIAO", "PROPOSTA", "NEGOCIACAO", "GANHO", "PERDIDO", "DESCADASTRADO", "BLOQUEADO",
];

export const STATUS_LABELS = {
  PESQUISADO: "Pesquisado", QUALIFICADO: "Qualificado", CONTATO_AUTORIZADO: "Contato autorizado",
  AGUARDANDO_APROVACAO: "Aguardando aprovação", CONTATADO: "Contatado", RESPONDEU: "Respondeu",
  REUNIAO: "Reunião", PROPOSTA: "Proposta", NEGOCIACAO: "Negociação", GANHO: "Ganho", PERDIDO: "Perdido",
  DESCADASTRADO: "Descadastrado", BLOQUEADO: "Bloqueado",
};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const int = new Intl.NumberFormat("pt-BR");

export function formatBRL(value) {
  if (value === null || value === undefined || value === "" || Number.isNaN(Number(value))) return "—";
  return brl.format(Number(value));
}

export function formatInt(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return int.format(Number(value));
}

export function formatPct(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return `${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

export function statusLabel(status) {
  return STATUS_LABELS[status] ?? status ?? "—";
}

/** Converte [{status, quantidade}] em lista ordenada com largura relativa (0–100) para as barras. */
export function pipelineBars(pipeline) {
  const counts = new Map((pipeline ?? []).map((p) => [p.status, Number(p.quantidade) || 0]));
  const max = Math.max(1, ...counts.values());
  return PIPELINE_ORDER.filter((s) => counts.has(s)).map((status) => ({
    status,
    label: statusLabel(status),
    count: counts.get(status),
    width: Math.round((counts.get(status) / max) * 100),
  }));
}

/** Seleciona os KPIs exibidos no topo a partir do objeto achatado `kpis` do painel. */
export function headlineKpis(kpis = {}) {
  return [
    { key: "pesquisa.leads_qualificados", label: "Leads qualificados", value: formatInt(kpis["pesquisa.leads_qualificados"]) },
    { key: "contato.mensagens_enviadas", label: "Mensagens enviadas", value: formatInt(kpis["contato.mensagens_enviadas"]) },
    { key: "contato.taxa_resposta_pct", label: "Taxa de resposta", value: formatPct(kpis["contato.taxa_resposta_pct"]) },
    { key: "vendas.reunioes", label: "Reuniões", value: formatInt(kpis["vendas.reunioes"]) },
    { key: "vendas.propostas_enviadas", label: "Propostas enviadas", value: formatInt(kpis["vendas.propostas_enviadas"]) },
    { key: "vendas.contratos_fechados", label: "Contratos", value: formatInt(kpis["vendas.contratos_fechados"]) },
  ];
}

/** As quatro categorias de receita, nunca somadas entre si. */
export function revenueRows(kpis = {}) {
  return [
    { label: "1. Potencial estimada", value: formatBRL(kpis["receita.1_potencial_estimada"]), hint: "preço de tabela × leads abertos" },
    { label: "2. Propostas emitidas", value: formatBRL(kpis["receita.2_propostas_emitidas_valor"]), hint: "valor das propostas enviadas" },
    { label: "3. Contratada", value: formatBRL(kpis["receita.3_contratada_valor"]), hint: "contratos assinados" },
    { label: "4. Recebida", value: formatBRL(kpis["receita.4_recebida_valor"]), hint: "dinheiro em conta" },
    { label: "Receita recorrente mensal", value: formatBRL(kpis["receita.receita_recorrente_mensal"]), hint: "contratos ativos recorrentes" },
  ];
}

export function levelLabel(level) {
  return { 1: "Nível 1", 2: "Nível 2", 3: "Nível 3 — validação humana" }[level] ?? `Nível ${level}`;
}
