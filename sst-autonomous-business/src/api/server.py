"""API REST (biblioteca padrão) para o painel JavaScript, conector personalizado do Power Apps/Power Automate
e Power BI.

Segurança:
- Exige SST_API_TOKEN (mín. 24 caracteres) em `Authorization: Bearer <token>` ou `X-API-Key: <token>`.
- Escuta em 127.0.0.1 por padrão. Para o Power Platform na nuvem, publique via túnel HTTPS
  (ex.: Cloudflare Tunnel) ou gateway de dados local — nunca exponha HTTP puro.
- Erros não devolvem segredos (mensagens passam por `redact`).
- Toda ação passa pelas mesmas regras do agente (níveis de autonomia, aprovações, portão de envio).
"""
from __future__ import annotations

import hmac
import json
import mimetypes
import re
import threading
import traceback
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Callable
from urllib.parse import parse_qs, urlparse

from ..settings import BASE_DIR, env, redact

MIN_TOKEN = 24
MAX_BODY = 2_000_000
WEB_DIR = BASE_DIR / "web"


class ApiError(Exception):
    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.message = message


# --------------------------------------------------------------------------- rotas
def _status(app, q, body):
    from ..status import status_payload
    return status_payload(app)


def _leads(app, q, body):
    sql = ("SELECT l.id, c.name AS empresa, c.segment AS segmento, c.city AS cidade, l.score AS pontuacao, "
           "l.priority AS prioridade, l.status, l.next_action AS proxima_acao, l.updated_at AS atualizado_em "
           "FROM leads l JOIN companies c ON c.id = l.company_id")
    params: list = []
    if q.get("status"):
        sql += " WHERE l.status = ?"
        params.append(q["status"])
    limit = min(int(q.get("limit") or 200), 1000)
    rows = app.db.all(sql + " ORDER BY l.score DESC NULLS LAST, l.id LIMIT ?", (*params, limit))
    from ..crm.pipeline import LABELS
    return [dict(r) | {"status_rotulo": LABELS.get(r["status"], r["status"])} for r in rows]


def _lead(app, q, body, lead_id):
    from ..crm import repository
    return repository.lead_view(app, int(lead_id))


def _approvals(app, q, body):
    status = q.get("status") or "PENDENTE"
    return [dict(r) for r in app.db.all(
        "SELECT id, action, level, subject_type, subject_id, summary, status, created_at, decided_at, decided_by "
        "FROM approvals WHERE status=? ORDER BY id", (status,))]


def _decide(app, q, body, approval_id):
    from ..powerplatform import bridge
    return bridge.execute(app, {"type": "approval_decision", "approval_id": int(approval_id),
                                "approve": body.get("approve"), "note": body.get("note"),
                                "by": body.get("by")}, channel="api")


def _messages(app, q, body):
    sql = ("SELECT id, lead_id, direction, kind, step, status, subject, error, intent, created_at, sent_at "
           "FROM messages")
    params: list = []
    if q.get("status"):
        sql += " WHERE status=?"
        params.append(q["status"])
    limit = min(int(q.get("limit") or 50), 500)
    return [dict(r) for r in app.db.all(sql + " ORDER BY id DESC LIMIT ?", (*params, limit))]


def _message(app, q, body, message_id):
    row = app.db.one("SELECT id, lead_id, direction, kind, status, subject, body, error, created_at, sent_at "
                     "FROM messages WHERE id=?", (int(message_id),))
    if row is None:
        raise ApiError(404, "mensagem não encontrada")
    return dict(row)


def _inbound(app, q, body):
    from ..powerplatform import bridge
    return bridge.execute(app, {"type": "inbound_message", **body}, channel="api")


def _kill_switch(app, q, body):
    from ..powerplatform import bridge
    return bridge.execute(app, {"type": "kill_switch", "on": body.get("on"), "reason": body.get("reason"),
                                "by": body.get("by")}, channel="api")


def _import(app, q, body):
    from ..powerplatform import bridge
    return bridge.execute(app, {"type": "leads_import", "rows": body.get("rows"), "by": body.get("by")},
                          channel="api")


def _run_job(app, q, body, name):
    from ..powerplatform import bridge
    return bridge.execute(app, {"type": "run_job", "name": name, "by": body.get("by")}, channel="api")


def _metrics(app, q, body):
    from ..analytics import metrics
    return metrics.compute(app)


def _snapshot(app, q, body):
    from ..powerplatform import export
    return export.snapshot(app)


def _powerbi(app, q, body, table):
    from ..powerplatform import export
    if (q.get("format") or "json") == "csv":
        return RawResponse(export.table_csv(app, table).encode("utf-8-sig"), "text/csv; charset=utf-8")
    headers, rows = export.table_rows(app, table)
    return [dict(zip(headers, r)) for r in rows]


def _integrations(app, q, body):
    from ..integrations import registry
    return registry.as_dicts(registry.check_all(app, network=False))


class RawResponse:
    def __init__(self, data: bytes, content_type: str) -> None:
        self.data = data
        self.content_type = content_type


ROUTES: list[tuple[str, re.Pattern, Callable]] = [
    ("GET", re.compile(r"^/api/status$"), _status),
    ("GET", re.compile(r"^/api/painel$"), _snapshot),
    ("GET", re.compile(r"^/api/metrics$"), _metrics),
    ("GET", re.compile(r"^/api/integrations$"), _integrations),
    ("GET", re.compile(r"^/api/leads$"), _leads),
    ("GET", re.compile(r"^/api/leads/(\d+)$"), _lead),
    ("POST", re.compile(r"^/api/leads/import$"), _import),
    ("GET", re.compile(r"^/api/approvals$"), _approvals),
    ("POST", re.compile(r"^/api/approvals/(\d+)/decision$"), _decide),
    ("GET", re.compile(r"^/api/messages$"), _messages),
    ("GET", re.compile(r"^/api/messages/(\d+)$"), _message),
    ("POST", re.compile(r"^/api/inbound$"), _inbound),
    ("POST", re.compile(r"^/api/kill-switch$"), _kill_switch),
    ("POST", re.compile(r"^/api/jobs/([a-z_]+)$"), _run_job),
    ("GET", re.compile(r"^/api/powerbi/([a-z_]+)$"), _powerbi),
]


# --------------------------------------------------------------------------- servidor
class ApiServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address, app_factory: Callable, token: str, cors_origin: str | None = None) -> None:
        if not token or len(token) < MIN_TOKEN:
            raise RuntimeError(f"defina SST_API_TOKEN com pelo menos {MIN_TOKEN} caracteres aleatórios")
        super().__init__(address, ApiHandler)
        self.app_factory = app_factory
        self.token = token
        self.cors_origin = cors_origin
        self.db_lock = threading.Lock()  # SQLite: uma escrita por vez neste processo


class ApiHandler(BaseHTTPRequestHandler):
    server: ApiServer
    server_version = "SSTAgentAPI/0.2"
    sys_version = ""

    def log_message(self, fmt, *args) -> None:  # silencia log padrão (vai para o logger com redação)
        pass

    # ------------------------------------------------------------------ util
    def _send(self, status: int, payload=None, content_type: str = "application/json; charset=utf-8",
              raw: bytes | None = None) -> None:
        data = raw if raw is not None else json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if self.server.cors_origin:
            self.send_header("Access-Control-Allow-Origin", self.server.cors_origin)
            self.send_header("Vary", "Origin")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)

    def _authorized(self) -> bool:
        auth = self.headers.get("Authorization", "")
        token = auth[7:].strip() if auth.lower().startswith("bearer ") else self.headers.get("X-API-Key", "")
        return bool(token) and hmac.compare_digest(token.encode(), self.server.token.encode())

    def _body(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_BODY:
            raise ApiError(413, "corpo da requisição muito grande")
        if not length:
            return {}
        try:
            data = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ApiError(400, "JSON inválido") from exc
        if not isinstance(data, dict):
            raise ApiError(400, "o corpo deve ser um objeto JSON")
        return data

    def _static(self, path: str) -> None:
        rel = "index.html" if path in ("/", "") else path.lstrip("/")
        if rel.startswith("web/"):
            rel = rel[4:]
        target = (WEB_DIR / rel).resolve()
        if (WEB_DIR.resolve() not in target.parents or not target.is_file()
                or (WEB_DIR / "tests").resolve() in target.parents or target.name == "package.json"):
            raise ApiError(404, "não encontrado")
        ctype = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype.endswith("javascript"):
            ctype += "; charset=utf-8"
        self._send(200, raw=target.read_bytes(), content_type=ctype)

    # ------------------------------------------------------------------ verbos
    def do_OPTIONS(self) -> None:  # preflight CORS
        self.send_response(204)
        if self.server.cors_origin:
            self.send_header("Access-Control-Allow-Origin", self.server.cors_origin)
            self.send_header("Access-Control-Allow-Headers", "Authorization, X-API-Key, Content-Type")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()

    def do_GET(self) -> None:
        self._dispatch("GET")

    def do_POST(self) -> None:
        self._dispatch("POST")

    def _dispatch(self, method: str) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        try:
            if method == "GET" and path == "/api/health":
                return self._send(200, {"status": "ok"})
            if method == "GET" and path == "/openapi.json":
                from .openapi import build_spec
                return self._send(200, build_spec(host=self.headers.get("Host")))
            if method == "GET" and not path.startswith("/api/"):
                return self._static(path)
            if not self._authorized():
                raise ApiError(401, "token ausente ou inválido")
            for verb, pattern, handler in ROUTES:
                match = pattern.match(path)
                if match and verb == method:
                    query = {k: v[-1] for k, v in parse_qs(parsed.query).items()}
                    body = self._body() if method == "POST" else {}
                    with self.server.db_lock:
                        app = self.server.app_factory()
                        try:
                            result = handler(app, query, body, *match.groups())
                        finally:
                            app.close()
                    if isinstance(result, RawResponse):
                        return self._send(200, raw=result.data, content_type=result.content_type)
                    return self._send(200, result)
            if any(p.match(path) for _, p, _ in ROUTES):
                raise ApiError(405, "método não permitido")
            raise ApiError(404, "rota não encontrada")
        except ApiError as exc:
            self._send(exc.status, {"erro": exc.message})
        except (ValueError, KeyError, TypeError) as exc:
            self._send(400, {"erro": redact(str(exc))})
        except Exception as exc:  # noqa: BLE001 - nunca derrubar o servidor
            import logging
            logging.getLogger("sst").error("API: erro interno: %s\n%s", redact(repr(exc)),
                                           redact(traceback.format_exc())[-1500:])
            self._send(500, {"erro": "erro interno; ver data/logs/alerts.log"})


def make_server(app_factory: Callable, *, host: str | None = None, port: int | None = None,
                token: str | None = None) -> ApiServer:
    return ApiServer((host or env("SST_API_HOST", "127.0.0.1"), int(port if port is not None else env("SST_API_PORT", "8765"))),
                     app_factory, token or env("SST_API_TOKEN") or "", cors_origin=env("SST_API_CORS_ORIGIN"))


def serve(app_factory: Callable) -> None:
    server = make_server(app_factory)
    host, port = server.server_address[:2]
    import logging
    logging.getLogger("sst").info("API em http://%s:%s (painel em /, especificação em /openapi.json)", host, port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
