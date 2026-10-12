// Painel do SST Agent — JavaScript puro (sem build). Todo dado entra no DOM via textContent.
import { ApiError, createClient, getToken, setToken } from "./api.js";
import {
  PIPELINE_ORDER, formatDateTime, formatInt, headlineKpis, levelLabel, pipelineBars, revenueRows, statusLabel,
} from "./format.js";

const api = createClient();
const $ = (id) => document.getElementById(id);
const JOBS = [
  ["qualify", "Qualificar leads"], ["outreach", "Preparar/enviar contatos"], ["followups", "Follow-ups devidos"],
  ["daily_report", "Relatório diário"], ["powerbi_export", "Exportar Power BI"], ["recover", "Recuperação"],
];
let state = { killOn: false };

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null) el.setAttribute(k, v);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

function empty(text) { return h("p", { class: "empty" }, text); }

function chip(text, kind) { return h("span", { class: `chip ${kind}` }, text); }

function renderChips(p) {
  const chips = [
    p.kill_switch.ativo ? chip(`Envios PAUSADOS (${p.kill_switch.motivo})`, "danger") : chip("Kill switch desligado", "ok"),
    p.envio_externo_habilitado ? chip("Envio externo habilitado", "ok") : chip("Envio externo desabilitado", "warn"),
    p.identidade_configurada ? chip("Identidade configurada", "ok") : chip("Identidade não configurada", "warn"),
  ];
  if (p.simulacao) chips.unshift(chip("SIMULAÇÃO", "warn"));
  $("chips").replaceChildren(...chips);
  state.killOn = p.kill_switch.ativo;
  $("btn-kill").textContent = state.killOn ? "Retomar envios" : "Pausar envios";
  $("btn-kill").className = state.killOn ? "ok" : "danger";
  const banner = $("banner");
  banner.hidden = !p.mensagens_incertas;
  banner.textContent = p.mensagens_incertas
    ? `${p.mensagens_incertas} mensagem(ns) INCERTA(s): o processo caiu durante o envio. Confira a caixa de saída antes de qualquer reenvio.`
    : "";
}

function renderKpis(kpis) {
  $("kpis").replaceChildren(...headlineKpis(kpis).map((k) =>
    h("div", { class: "kpi", "data-kpi": k.key }, h("div", { class: "value" }, k.value), h("div", { class: "label" }, k.label))));
  $("revenue").replaceChildren(...revenueRows(kpis).map((r) =>
    h("div", {}, h("dt", {}, r.label, h("small", {}, r.hint)), h("dd", {}, r.value))));
}

function renderPipeline(pipeline) {
  const bars = pipelineBars(pipeline);
  $("pipeline").replaceChildren(...(bars.length ? bars.map((b) => h("li", {},
    h("span", {}, b.label),
    h("span", { class: "track", role: "img", "aria-label": `${b.label}: ${b.count}` },
      h("span", { class: "fill", style: `width:${b.width}%` })),
    h("span", { class: "n" }, formatInt(b.count)))) : [empty("Nenhum lead ainda.")]));
}

function renderApprovals(list) {
  $("approvals-count").textContent = String(list.length);
  if (!list.length) return $("approvals").replaceChildren(empty("Nada aguardando sua decisão."));
  $("approvals").replaceChildren(...list.map((a) => {
    const decide = async (approve, btn) => {
      const note = approve ? "" : (prompt("Motivo da rejeição (opcional):") ?? "");
      btn.disabled = true;
      try { await api.decide(a.id, approve, note); await refresh(); } catch (e) { alert(e.message); btn.disabled = false; }
    };
    const buttons = [];
    if (a.action === "send_first_contact" || a.subject_type === "message") {
      buttons.push(h("button", { type: "button", class: "ghost", onclick: () => showMessage(a.subject_id) }, "Ver mensagem"));
    }
    buttons.push(h("button", { type: "button", class: "ok", onclick: (e) => decide(true, e.currentTarget) }, "Aprovar"));
    buttons.push(h("button", { type: "button", class: "danger", onclick: (e) => decide(false, e.currentTarget) }, "Rejeitar"));
    return h("li", { "data-approval": a.id },
      h("div", {}, a.summary),
      h("div", { class: "meta" }, `#${a.id} · ${a.action} · ${levelLabel(a.level)} · ${formatDateTime(a.created_at)}`),
      h("div", { class: "buttons" }, buttons));
  }));
}

async function showMessage(id) {
  try {
    const m = await api.message(id);
    alert(`Assunto: ${m.subject ?? ""}\n\n${m.body ?? ""}`);
  } catch (e) { alert(e.message); }
}

function renderLeads(leads) {
  if (!leads.length) return $("leads").replaceChildren(h("tr", {}, h("td", { colspan: 7, class: "empty" }, "Nenhum lead.")));
  $("leads").replaceChildren(...leads.map((l) => h("tr", {},
    h("td", {}, l.id), h("td", { class: "wrap" }, l.empresa), h("td", {}, l.segmento), h("td", {}, l.cidade ?? "—"),
    h("td", { class: "num" }, l.pontuacao ?? "—"), h("td", {}, statusLabel(l.status)),
    h("td", { class: "wrap" }, l.proxima_acao ?? "—"))));
}

function renderMessages(messages) {
  if (!messages.length) return $("messages").replaceChildren(h("tr", {}, h("td", { colspan: 5, class: "empty" }, "Nenhuma mensagem.")));
  $("messages").replaceChildren(...messages.map((m) => h("tr", { title: m.error ?? "" },
    h("td", {}, m.id), h("td", {}, m.lead_id ?? "—"), h("td", {}, `${m.direction === "IN" ? "↓" : "↑"} ${m.kind}`),
    h("td", {}, m.status), h("td", {}, formatDateTime(m.sent_at ?? m.created_at)))));
}

function renderIntegrations(list) {
  $("integrations").replaceChildren(...(list.length
    ? list.map((i) => h("li", {}, h("strong", {}, i.name), `: ${i.reason}`, i.action_needed ? ` → ${i.action_needed}` : ""))
    : [h("li", { class: "empty" }, "Nenhuma pendência registrada.")]));
}

async function loadLeads() {
  renderLeads(await api.leads($("lead-filter").value));
}

async function refresh() {
  const btn = $("btn-refresh");
  btn.disabled = true;
  try {
    const [painel, messages] = await Promise.all([api.painel(), api.messages()]);
    $("generated").textContent = `Atualizado em ${formatDateTime(painel.gerado_em)}`;
    renderChips(painel);
    renderKpis(painel.kpis);
    renderPipeline(painel.pipeline);
    renderApprovals(painel.aprovacoes);
    renderMessages(messages);
    renderIntegrations(painel.integracoes_pendentes);
    await loadLeads();
    $("main").hidden = false;
  } catch (e) {
    handleError(e);
  } finally {
    btn.disabled = false;
  }
}

function handleError(e) {
  if (e instanceof ApiError && e.status === 401) {
    setToken("");
    $("login-error").textContent = "Token inválido.";
    openLogin();
    return;
  }
  alert(`Erro: ${e.message}`);
}

function openLogin() {
  $("main").hidden = true;
  if (!$("login").open) $("login").showModal();
}

function setup() {
  $("lead-filter").append(...PIPELINE_ORDER.map((s) => h("option", { value: s }, statusLabel(s))));
  $("lead-filter").addEventListener("change", () => loadLeads().catch(handleError));
  $("btn-refresh").addEventListener("click", refresh);
  $("btn-logout").addEventListener("click", () => { setToken(""); openLogin(); });
  $("btn-kill").addEventListener("click", async () => {
    const turningOn = !state.killOn;
    const reason = turningOn ? prompt("Motivo da pausa dos envios:", "pausa manual pelo painel") : "retomado pelo painel";
    if (turningOn && reason === null) return;
    try { await api.killSwitch(turningOn, reason); await refresh(); } catch (e) { handleError(e); }
  });
  $("jobs").replaceChildren(...JOBS.map(([name, label]) => h("button", {
    type: "button", class: "ghost", onclick: async (ev) => {
      const b = ev.currentTarget; b.disabled = true;
      try {
        const out = await api.runJob(name);
        $("job-output").hidden = false;
        $("job-output").textContent = JSON.stringify(out, null, 2);
        await refresh();
      } catch (e) { handleError(e); } finally { b.disabled = false; }
    },
  }, label)));
  $("inbound-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const form = new FormData(ev.currentTarget);
    try {
      const out = await api.inbound({ from: form.get("from"), subject: form.get("subject"), body: form.get("body") });
      $("inbound-result").textContent = `Intenção: ${out.intent ?? out.status} · ações: ${(out.acoes ?? []).join(", ") || "nenhuma"}`;
      ev.currentTarget.reset();
      await refresh();
    } catch (e) { handleError(e); }
  });
  $("login-form").addEventListener("submit", (ev) => {
    const token = $("token").value.trim();
    if (token.length < 24) { ev.preventDefault(); $("login-error").textContent = "O token tem pelo menos 24 caracteres."; return; }
    setToken(token);
    $("login-error").textContent = "";
    refresh();
  });
  if (getToken()) refresh(); else openLogin();
}

setup();
