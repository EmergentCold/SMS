// Cliente da API REST do agente. O token fica apenas em sessionStorage (some ao fechar a aba).

const TOKEN_KEY = "sst-agent-token";

export function getToken() {
  try { return sessionStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
}

export function setToken(token) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch { /* armazenamento indisponível: token vale só nesta página */ }
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function createClient({ baseUrl = "", token = getToken, fetchImpl = globalThis.fetch } = {}) {
  async function request(method, path, body) {
    const headers = { Accept: "application/json", Authorization: `Bearer ${typeof token === "function" ? token() : token}` };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetchImpl(`${baseUrl}${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data = null;
    try { data = await res.json(); } catch { /* resposta vazia */ }
    if (!res.ok) throw new ApiError(res.status, data?.erro ?? `HTTP ${res.status}`);
    return data;
  }
  return {
    painel: () => request("GET", "/api/painel"),
    status: () => request("GET", "/api/status"),
    leads: (status) => request("GET", `/api/leads${status ? `?status=${encodeURIComponent(status)}` : ""}`),
    lead: (id) => request("GET", `/api/leads/${Number(id)}`),
    messages: () => request("GET", "/api/messages?limit=30"),
    message: (id) => request("GET", `/api/messages/${Number(id)}`),
    decide: (id, approve, note) => request("POST", `/api/approvals/${Number(id)}/decision`, { approve, note, by: "painel-web" }),
    killSwitch: (on, reason) => request("POST", "/api/kill-switch", { on, reason, by: "painel-web" }),
    inbound: (payload) => request("POST", "/api/inbound", payload),
    runJob: (name) => request("POST", `/api/jobs/${encodeURIComponent(name)}`, { by: "painel-web" }),
  };
}
