// Teste ponta a ponta do painel: sobe a API Python com banco temporário, abre o Chromium e opera a interface.
// Uso (na pasta web/):  npm i -D playwright && npx playwright install chromium && npm run e2e
// Variáveis opcionais: PLAYWRIGHT_MODULE (caminho do pacote), E2E_SCREENSHOT (arquivo PNG a gerar).
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(here, "..", "..");
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");

const tmp = mkdtempSync(path.join(tmpdir(), "sst-e2e-"));
const token = "e2e-token-" + "x".repeat(30);
const port = String(20000 + Math.floor(Math.random() * 20000));
const env = {
  ...process.env, SST_DATA_DIR: tmp, SST_DB_PATH: path.join(tmp, "e2e.db"), SST_REPORTS_DIR: path.join(tmp, "reports"),
  SST_API_TOKEN: token, SST_API_PORT: port, EXTERNAL_SENDING_ENABLED: "false", PYTHONUNBUFFERED: "1",
};

// Dados de teste (domínios .test): 2 leads e 1 aprovação pendente.
const seed = spawnSync("python3", ["-c", `
from src.app import build_app
from src.compliance import permissions
from src.research import importer
from src.crm import scoring
app = build_app()
importer.import_rows(app, [
  {"name": "E2E Transportes", "website": "https://e2e-transp.test", "segment": "transportadora", "city": "Guarulhos",
   "contact_email": "contato@e2e-transp.test", "source_url": "https://e2e-transp.test/contato",
   "facts": "expansao: site menciona nova unidade"},
  {"name": "E2E Indústria", "website": "https://e2e-ind.test", "segment": "industria", "city": "Curitiba", "state": "PR",
   "source_description": "lista de teste"}])
scoring.qualify_pending(app)
permissions.request_approval(app, "adjust_campaign", "campaign", 1, "Ajustar campanha de teste E2E")
app.close()
`], { cwd: project, env, encoding: "utf-8" });
assert.equal(seed.status, 0, seed.stderr);

const server = spawn("python3", ["-m", "src.main", "api"], { cwd: project, env, stdio: ["ignore", "pipe", "pipe"] });
let serverLog = "";
server.stdout.on("data", (d) => { serverLog += d; });
server.stderr.on("data", (d) => { serverLog += d; });
const base = `http://127.0.0.1:${port}`;

async function waitHealth() {
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) return; } catch { /* ainda subindo */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("API não respondeu:\n" + serverLog);
}

let browser;
try {
  await waitHealth();
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/");

  await page.fill("#token", token);
  await page.click("#login-form button[type=submit]");
  await page.waitForSelector("#main:not([hidden])");

  assert.equal(await page.locator("#leads tr").count(), 2, "dois leads na tabela");
  assert.equal(await page.textContent("#approvals-count"), "1");
  assert.equal(await page.locator("#kpis .kpi").count(), 6);
  assert.match(await page.textContent("#chips"), /Envio externo desabilitado/);
  assert.match(await page.textContent("#pipeline"), /Contato autorizado|Pesquisado/);

  await page.selectOption("#lead-filter", "PESQUISADO");
  await page.waitForFunction(() => document.querySelectorAll("#leads tr").length === 1);

  if (process.env.E2E_SCREENSHOT) await page.screenshot({ path: process.env.E2E_SCREENSHOT, fullPage: true });

  await page.click("#approvals button.ok");
  await page.waitForFunction(() => document.querySelector("#approvals-count").textContent === "0");
  const decided = await (await fetch(`${base}/api/approvals?status=APROVADO`, { headers: { Authorization: `Bearer ${token}` } })).json();
  assert.equal(decided[0].decided_by, "api:painel-web");

  page.once("dialog", (d) => d.accept("teste e2e"));
  await page.click("#btn-kill");
  await page.waitForFunction(() => /PAUSADOS/.test(document.querySelector("#chips").textContent));

  await page.fill("#inbound-form [name=from]", "contato@e2e-transp.test");
  await page.fill("#inbound-form [name=body]", "Temos interesse, podemos conversar?");
  await page.click("#inbound-form button[type=submit]");
  await page.waitForFunction(() => /INTERESSE/.test(document.querySelector("#inbound-result").textContent));

  assert.deepEqual(errors, [], "sem erros de JavaScript na página");
  console.log("E2E OK: login, KPIs, pipeline, filtro de leads, aprovação, kill switch e registro de resposta");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  rmSync(tmp, { recursive: true, force: true });
}
