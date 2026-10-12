import json
import threading
import urllib.error
import urllib.request

import pytest

from src.api.openapi import build_spec
from src.api.server import ROUTES, make_server
from src.app import App
from src.compliance import permissions
from src.crm import pipeline
from src.database import open_db
from src.outreach import sender
from tests.conftest import make_lead

TOKEN = "t0ken-de-teste-com-mais-de-24-caracteres"


@pytest.fixture
def api(app):
    def factory():
        return App(settings=app.settings, db=open_db(app.settings.db_path), log=app.log, overrides=app.overrides)

    server = make_server(factory, host="127.0.0.1", port=0, token=TOKEN)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_address[1]}"

    def call(method, path, body=None, token=TOKEN, header="Authorization"):
        data = None if body is None else json.dumps(body).encode()
        req = urllib.request.Request(base + path, data=data, method=method)
        if token:
            req.add_header(header, f"Bearer {token}" if header == "Authorization" else token)
        if data is not None:
            req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                raw = resp.read()
                ctype = resp.headers.get("Content-Type", "")
                return resp.status, (json.loads(raw) if "json" in ctype else raw.decode("utf-8-sig"))
        except urllib.error.HTTPError as exc:
            return exc.code, json.loads(exc.read() or b"{}")

    yield call
    server.shutdown()
    server.server_close()


def test_server_refuses_weak_token(app):
    with pytest.raises(RuntimeError):
        make_server(lambda: app, host="127.0.0.1", port=0, token="curto")


def test_auth_is_required(api):
    assert api("GET", "/api/health", token=None)[0] == 200
    assert api("GET", "/api/painel", token=None)[0] == 401
    assert api("GET", "/api/painel", token="x" * 40)[0] == 401
    status, body = api("GET", "/api/painel", header="X-API-Key")
    assert status == 200 and "kpis" in body


def test_static_dashboard_and_spec_are_served(api):
    status, html = api("GET", "/", token=None)
    assert status == 200 and "Painel SST Agent" in html
    assert api("GET", "/js/app.js", token=None)[0] == 200
    assert api("GET", "/tests/format.test.mjs", token=None)[0] == 404
    assert api("GET", "/../config/business.json", token=None)[0] == 404
    status, spec = api("GET", "/openapi.json", token=None)
    assert status == 200 and spec["swagger"] == "2.0"


def test_approval_flow_through_api(api, sending):
    sending.settings.autonomy["actions"]["send_first_contact"]["enabled"] = False
    make_lead(sending)
    sender.run_outreach(sending)
    status, approvals = api("GET", "/api/approvals")
    assert status == 200 and len(approvals) == 1 and approvals[0]["action"] == "send_first_contact"
    status, result = api("POST", f"/api/approvals/{approvals[0]['id']}/decision", {"approve": True, "by": "dono@x.test"})
    assert status == 200 and result["status"] == "APROVADO"
    assert api("POST", f"/api/approvals/{approvals[0]['id']}/decision", {"approve": True})[0] == 400  # já decidida
    sender.dispatch_pending(sending)
    assert sending.db.scalar("SELECT status FROM leads") == pipeline.CONTATADO
    assert api("POST", "/api/approvals/999/decision", {"approve": "sim"})[0] == 400


def test_kill_switch_via_api(api, sending):
    status, out = api("POST", "/api/kill-switch", {"on": True, "reason": "teste api"})
    assert status == 200 and out["envios_pausados"] is True
    assert permissions.is_paused(sending)[0]
    api("POST", "/api/kill-switch", {"on": False})
    assert not permissions.is_paused(sending)[0]


def test_inbound_via_api_cancels_followups(api, sending):
    make_lead(sending)
    sender.run_outreach(sending)
    status, out = api("POST", "/api/inbound", {"from": "contato@transp-teste.test", "subject": "Re",
                                               "body": "Por favor descadastrar.", "message_id": "<x1@test>"})
    assert status == 200 and out["intent"] == "DESCADASTRO"
    assert sending.db.scalar("SELECT status FROM leads") == pipeline.DESCADASTRADO
    assert sending.db.scalar("SELECT COUNT(*) FROM tasks WHERE status='PENDENTE' AND kind='followup'") == 0


def test_leads_import_and_listing(api, app):
    rows = [{"name": "Empresa API", "website": "https://empresa-api.test", "segment": "industria", "city": "Guarulhos",
             "contact_email": "contato@empresa-api.test", "source_url": "https://empresa-api.test/contato"},
            {"name": "Sem origem", "website": "https://sem-origem.test", "segment": "industria"}]
    status, out = api("POST", "/api/leads/import", {"rows": rows, "by": "power-automate"})
    assert status == 200 and out["empresas_novas"] == 1 and out["rejeitadas"] == 1
    status, leads = api("GET", "/api/leads")
    assert status == 200 and leads[0]["empresa"] == "Empresa API" and leads[0]["status_rotulo"] == "Pesquisado"
    status, detail = api("GET", f"/api/leads/{leads[0]['id']}")
    assert detail["contacts"][0]["email"] == "contato@empresa-api.test"


def test_jobs_allowlist(api):
    assert api("POST", "/api/jobs/qualify", {})[0] == 200
    assert api("POST", "/api/jobs/backup", {})[0] == 400
    assert api("POST", "/api/jobs/research", {})[0] == 400


def test_powerbi_endpoints(api, app):
    make_lead(app)
    status, rows = api("GET", "/api/powerbi/fato_lead")
    assert status == 200 and rows[0]["status"] == "CONTATO_AUTORIZADO"
    status, csv_text = api("GET", "/api/powerbi/contatos_canal?format=csv")
    assert status == 200 and "co***@transp-teste.test" in csv_text and "contato@transp-teste.test" not in csv_text
    assert api("GET", "/api/powerbi/nao_existe")[0] == 400


def test_errors_do_not_leak_and_methods_checked(api):
    assert api("GET", "/api/kill-switch")[0] == 405
    assert api("GET", "/api/nada")[0] == 404
    assert api("POST", "/api/inbound", {"subject": "sem remetente"})[0] == 400


def test_openapi_matches_routes():
    spec = build_spec(host="sst.exemplo.test")
    assert spec["schemes"] == ["https"]
    op_ids = [op["operationId"] for path in spec["paths"].values() for op in path.values()]
    assert len(op_ids) == len(set(op_ids))
    for path, ops in spec["paths"].items():
        concrete = path.replace("{approval_id}", "1").replace("{name}", "qualify")
        for verb in ops:
            assert any(v == verb.upper() and p.match(concrete) for v, p, _ in ROUTES), (verb, path)
    for path in spec["paths"].values():
        for op in path.values():
            for resp in op["responses"].values():
                ref = resp.get("schema", {}).get("$ref") or resp.get("schema", {}).get("items", {}).get("$ref")
                if ref:
                    assert ref.split("/")[-1] in spec["definitions"]
