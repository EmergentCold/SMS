from datetime import datetime, timedelta

import pytest

from src.app import build_app
from src.scheduler import Cron, Scheduler
from src.settings import TZ, clock
from tests.conftest import ROOT


def test_cron_parsing_and_matching():
    cron = Cron("30 7 * * 1-5")
    assert cron.matches(datetime(2026, 10, 13, 7, 30, tzinfo=TZ))       # terça
    assert not cron.matches(datetime(2026, 10, 17, 7, 30, tzinfo=TZ))   # sábado
    assert Cron("*/15 7-20 * * *").matches(datetime(2026, 10, 18, 20, 45, tzinfo=TZ))
    assert Cron("0 17 * * 5").next(datetime(2026, 10, 13, 9, 0, tzinfo=TZ)) == datetime(2026, 10, 16, 17, 0, tzinfo=TZ)
    with pytest.raises(ValueError):
        Cron("61 * * * *")


def _scheduler(app, calls, fail=False):
    app.settings.schedule["jobs"] = [{"name": "pesquisa", "cron": "30 7 * * 1-5", "command": "x"}]

    def job():
        calls.append(1)
        if fail:
            raise RuntimeError("falhou token=segredo123")
        return "ok"
    return Scheduler(app, jobs={"x": job})


def test_job_runs_once_per_slot(app):
    calls = []
    sched = _scheduler(app, calls)
    ref = datetime(2026, 10, 13, 7, 31, tzinfo=TZ)
    sched.run_once(ref)
    sched.run_once(ref)
    assert len(calls) == 1
    assert app.db.scalar("SELECT status FROM job_runs") == "OK"


def test_missed_run_is_recovered_after_restart(tmp_path, app):
    calls = []
    _scheduler(app, calls).run_once(datetime(2026, 10, 13, 7, 31, tzinfo=TZ))
    app.close()
    # "reinício": nova instância sobre o mesmo banco, 2 horas após o horário de quarta-feira
    app2 = build_app(ROOT, db_path=app.settings.db_path, data_dir=app.settings.data_dir)
    try:
        sched = _scheduler(app2, calls)
        sched.run_once(datetime(2026, 10, 14, 9, 30, tzinfo=TZ))
        assert len(calls) == 2
        # fora da janela de tolerância (180 min): não executa disparo antigo
        sched.run_once(datetime(2026, 10, 15, 11, 0, tzinfo=TZ))
        assert len(calls) == 2
        slots = [r["scheduled_for"] for r in app2.db.all("SELECT scheduled_for FROM job_runs ORDER BY id")]
        assert slots == ["2026-10-13T07:30:00-03:00", "2026-10-14T07:30:00-03:00"]
    finally:
        app2.close()
        app.db = build_app(ROOT, db_path=app.settings.db_path, data_dir=app.settings.data_dir).db


def test_failed_job_is_recorded_and_redacted(app):
    calls = []
    sched = _scheduler(app, calls, fail=True)
    sched.run_once(datetime(2026, 10, 13, 7, 31, tzinfo=TZ))
    row = app.db.one("SELECT status, detail FROM job_runs")
    assert row["status"] == "FALHOU" and "segredo123" not in row["detail"]


def test_single_instance_lock(app):
    a = _scheduler(app, [])
    b = _scheduler(app, [])
    b.owner = "outra-maquina:1"
    assert a.acquire_lock()
    assert not b.acquire_lock()
    clock.set(datetime(2026, 10, 13, 10, 0, tzinfo=TZ) + timedelta(minutes=10))  # heartbeat expirado
    assert b.acquire_lock()


def test_interrupted_job_marked_failed(app):
    app.db.execute("INSERT INTO job_runs(job_name, scheduled_for, status, started_at) VALUES "
                   "('x', '2026-10-13T07:30:00-03:00', 'EXECUTANDO', '2026-10-13T07:30:00-03:00')")
    assert _scheduler(app, []).recover_interrupted() == 1


def test_all_configured_commands_exist(app):
    from src.scheduler import job_table
    table = job_table(app)
    for job in app.settings.schedule["jobs"]:
        assert job["command"] in table
        Cron(job["cron"])


def test_database_persists_between_sessions(tmp_path):
    db_path = tmp_path / "persist.db"
    a = build_app(ROOT, db_path=db_path, data_dir=tmp_path / "d")
    a.db.insert("companies", {"name": "Persistida", "created_at": "x", "updated_at": "x"})
    a.close()
    b = build_app(ROOT, db_path=db_path, data_dir=tmp_path / "d")
    assert b.db.scalar("SELECT name FROM companies") == "Persistida"
    backup = b.db.backup(tmp_path / "bk", keep=2)
    assert backup.exists()
    b.close()


def test_simulation_runs_end_to_end():
    """Regressão: a simulação ponta a ponta precisa continuar funcionando com a configuração real."""
    from src import simulation
    result = simulation.run()
    finals = result["estados_finais"]
    assert finals["EXEMPLO CD Logística Simulada"] == "GANHO"
    assert finals["EXEMPLO Transportes Fictícios"] == "DESCADASTRADO"
    assert any("bloqueado" in p for p in result["passos"])  # proposta sem preço não sai
