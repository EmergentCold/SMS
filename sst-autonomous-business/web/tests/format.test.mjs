import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatBRL, formatPct, headlineKpis, pipelineBars, revenueRows, statusLabel,
} from "../js/format.js";
import { ApiError, createClient } from "../js/api.js";

test("formata moeda e porcentagem em pt-BR sem inventar valores", () => {
  assert.equal(formatBRL(1500).replace(/\s/g, " "), "R$ 1.500,00");
  assert.equal(formatBRL(null), "—");
  assert.equal(formatPct(66.666), "66,7%");
  assert.equal(formatPct(undefined), "—");
});

test("barras do pipeline seguem a ordem do funil e são proporcionais", () => {
  const bars = pipelineBars([
    { status: "GANHO", quantidade: 1 }, { status: "PESQUISADO", quantidade: 4 }, { status: "CONTATADO", quantidade: 2 },
  ]);
  assert.deepEqual(bars.map((b) => b.status), ["PESQUISADO", "CONTATADO", "GANHO"]);
  assert.deepEqual(bars.map((b) => b.width), [100, 50, 25]);
  assert.equal(statusLabel("REUNIAO"), "Reunião");
  assert.deepEqual(pipelineBars([]), []);
});

test("receitas ficam em linhas separadas (nunca somadas)", () => {
  const rows = revenueRows({
    "receita.1_potencial_estimada": 3000, "receita.2_propostas_emitidas_valor": 1000,
    "receita.3_contratada_valor": 1000, "receita.4_recebida_valor": 500,
  });
  assert.equal(rows.length, 5);
  assert.match(rows[3].label, /Recebida/);
  assert.equal(rows[3].value.replace(/\s/g, " "), "R$ 500,00");
  assert.equal(headlineKpis({ "contato.taxa_resposta_pct": null })[2].value, "—");
});

test("cliente envia token e converte erro da API", async () => {
  const calls = [];
  const fakeFetch = async (url, opts) => {
    calls.push({ url, opts });
    if (url.endsWith("/api/painel")) return { ok: true, status: 200, json: async () => ({ ok: 1 }) };
    return { ok: false, status: 401, json: async () => ({ erro: "token ausente ou inválido" }) };
  };
  const client = createClient({ baseUrl: "http://x", token: "t".repeat(30), fetchImpl: fakeFetch });
  assert.deepEqual(await client.painel(), { ok: 1 });
  assert.equal(calls[0].opts.headers.Authorization, `Bearer ${"t".repeat(30)}`);
  await assert.rejects(client.decide(3, true, ""), (e) => e instanceof ApiError && e.status === 401);
  assert.equal(JSON.parse(calls[1].opts.body).approve, true);
  assert.equal(calls[1].url, "http://x/api/approvals/3/decision");
});
