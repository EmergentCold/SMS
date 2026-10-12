import csv
import json

from src.compliance import permissions
from src.outreach import sender
from src.powerplatform import bridge, export
from tests.conftest import make_lead


def _read_csv(path):
    with open(path, encoding="utf-8-sig", newline="") as fh:
        return list(csv.DictReader(fh))


def test_export_creates_star_schema_without_personal_data(sending):
    make_lead(sending)
    sender.run_outreach(sending)
    out = export.export_all(sending)
    root = export.export_dir(sending) / "export"
    assert out["arquivos"] == len(export.TABLES) + 2  # + kpis.csv e painel.json (manifest à parte)
    leads = _read_csv(root / "fato_lead.csv")
    assert leads[0]["status"] == "CONTATADO" and leads[0]["status_rotulo"] == "Contatado"
    all_text = "".join(p.read_text(encoding="utf-8-sig") for p in root.glob("*.csv"))
    assert "contato@transp-teste.test" not in all_text           # e-mail só mascarado
    assert "descadastrar" not in all_text.lower()                # nenhum corpo de mensagem
    painel = json.loads((root / "painel.json").read_text(encoding="utf-8"))
    assert painel["leads"][0]["status_rotulo"] == "Contatado" and "kpis" in painel
    kpis = {r["indicador"]: r["valor"] for r in _read_csv(root / "kpis.csv")}
    assert kpis["contato.primeiros_contatos"] == "1"


def test_simulation_never_writes_to_real_onedrive_folder(app, monkeypatch, tmp_path):
    monkeypatch.setenv("POWERPLATFORM_DIR", str(tmp_path / "onedrive"))
    assert export.export_dir(app) == tmp_path / "onedrive"
    app.settings.simulation = True
    assert export.export_dir(app) == app.settings.data_dir / "powerplatform"


def _inbox(app):
    return export.export_dir(app) / "inbox"


def test_bridge_processes_approval_once(app):
    make_lead(app)
    sender.run_outreach(app)
    approval_id = app.db.scalar("SELECT id FROM approvals")
    cmd = {"id": "cmd-1", "type": "approval_decision", "approval_id": approval_id, "approve": True, "by": "dono@x.test"}
    bridge.write_command(_inbox(app), cmd)
    assert bridge.process_inbox(app)["processados"] == 1
    assert app.db.scalar("SELECT status FROM approvals") == "APROVADO"
    assert app.db.scalar("SELECT decided_by FROM approvals") == "ponte:dono@x.test"
    bridge.write_command(_inbox(app), cmd)  # reenvio do mesmo comando
    assert bridge.process_inbox(app)["duplicados"] == 1
    result = json.loads((export.export_dir(app) / "outbox" / "cmd-1.result.json").read_text(encoding="utf-8"))
    assert result["status"] == "duplicado"
    assert (_inbox(app) / "processados" / "cmd-1.json").exists()
    assert (export.export_dir(app) / "export" / "painel.json").exists()  # estado devolvido ao Power Apps


def test_bridge_kill_switch_and_inbound(app):
    bridge.write_command(_inbox(app), {"id": "k1", "type": "kill_switch", "on": True, "reason": "celular"})
    bridge.write_command(_inbox(app), {"id": "m1", "type": "inbound_message", "from": "x@y.test",
                                       "body": "Por favor descadastrar"})
    stats = bridge.process_inbox(app)
    assert stats["processados"] == 2
    assert permissions.is_paused(app)[0]
    from src.compliance import suppression
    assert suppression.is_suppressed(app, email="x@y.test")[0]


def test_bridge_rejects_invalid_commands(app, monkeypatch):
    inbox = _inbox(app)
    inbox.mkdir(parents=True, exist_ok=True)
    (inbox / "ruim.json").write_text("{nao é json", encoding="utf-8")
    bridge.write_command(inbox, {"id": "j1", "type": "run_job", "name": "backup"})
    bridge.write_command(inbox, {"id": "x1", "type": "apagar_tudo"})
    stats = bridge.process_inbox(app)
    assert (stats["processados"], stats["falhas"], stats["duplicados"]) == (0, 3, 0)
    assert len(list((inbox / "falhas").glob("*.json"))) == 3
    monkeypatch.setenv("SST_BRIDGE_TOKEN", "segredo-da-ponte-123")
    bridge.write_command(inbox, {"id": "k2", "type": "kill_switch", "on": True})
    bridge.write_command(inbox, {"id": "k3", "type": "kill_switch", "on": True, "token": "segredo-da-ponte-123"})
    stats = bridge.process_inbox(app)
    assert stats["falhas"] == 1 and stats["processados"] == 1
    err = json.loads((export.export_dir(app) / "outbox" / "k2.result.json").read_text(encoding="utf-8"))
    assert "segredo-da-ponte-123" not in json.dumps(err)


def test_bridge_imports_leads_with_traceability(app):
    rows = [{"name": "Ponte SA", "website": "https://ponte-sa.test", "segment": "transportadora",
             "source_description": "lista do proprietário (evento do setor)"}]
    bridge.write_command(_inbox(app), {"id": "i1", "type": "leads_import", "rows": rows})
    bridge.process_inbox(app)
    assert app.db.scalar("SELECT name FROM companies") == "Ponte SA"
    assert app.db.scalar("SELECT description FROM data_sources") == "lista do proprietário (evento do setor)"


def test_scheduler_has_powerplatform_jobs(app):
    from src.scheduler import job_table
    table = job_table(app)
    assert "powerbi_export" in table and "powerplatform_inbox" in table


def test_one_file_per_new_approval_for_power_automate(app):
    from src.compliance import permissions as perm
    a1 = perm.request_approval(app, "adjust_campaign", "campaign", 1, "Ajustar campanha A")
    out = export.sync_approval_files(app)
    folder = export.export_dir(app) / "aprovacoes"
    assert out["criados"] == 1 and (folder / f"aprovacao-{a1}.json").exists()
    data = json.loads((folder / f"aprovacao-{a1}.json").read_text(encoding="utf-8"))
    assert data["titulo"].startswith("SST Agent:") and data["level"] == 2
    assert export.sync_approval_files(app)["criados"] == 0          # não repete
    (folder / f"aprovacao-{a1}.json").unlink()                       # fluxo apagou após notificar
    assert export.sync_approval_files(app)["criados"] == 0          # e não recria
    a2 = perm.request_approval(app, "adjust_campaign", "campaign", 2, "Ajustar campanha B")
    export.sync_approval_files(app)
    perm.decide(app, a2, False)
    assert export.sync_approval_files(app)["removidos"] == 1         # decidida → arquivo removido


def test_snapshot_has_simple_keys_for_power_fx(app):
    snap = export.snapshot(app)
    assert all("." not in key for key in snap["resumo"])
    assert snap["resumo"]["contratos"] == 0
