"""CLI do SST Autonomous Business Agent.

Uso: python -m src.main <comando> [opções]   (execute na pasta do projeto)
Ajuda: python -m src.main --help
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

from .app import build_app
from .settings import TZ, iso


def _print(data) -> None:
    print(json.dumps(data, ensure_ascii=False, indent=2, default=str))


def cmd_status(app, args) -> None:
    from .status import status_payload
    _print(status_payload(app))


def cmd_integrations(app, args) -> None:
    from .integrations import registry
    _print(registry.as_dicts(registry.check_all(app, network=not args.offline)))


def cmd_leads(app, args) -> None:
    from .crm import repository, scoring
    from .research import importer

    if args.leads_cmd == "import":
        _print(importer.import_csv(app, Path(args.file)))
    elif args.leads_cmd == "list":
        sql = ("SELECT l.id, c.name, c.segment, c.city, l.score, l.priority, l.status, l.next_action FROM leads l "
               "JOIN companies c ON c.id = l.company_id")
        params: tuple = ()
        if args.status:
            sql += " WHERE l.status = ?"
            params = (args.status,)
        _print([dict(r) for r in app.db.all(sql + " ORDER BY l.score DESC NULLS LAST, l.id", params)])
    elif args.leads_cmd == "show":
        _print(repository.lead_view(app, args.id))
    elif args.leads_cmd == "score":
        result = scoring.score_lead(app, args.id)
        _print(result.__dict__)
    elif args.leads_cmd == "transition":
        from .crm import pipeline
        changed = pipeline.transition(app, args.id, args.to, evidence_type="decisao_humana",
                                      evidence_ref=f"proprietario:{iso()}", reason=args.reason)
        _print({"alterado": changed})


def cmd_approvals(app, args) -> None:
    from .compliance import permissions
    from .proposals import generator
    if args.ap_cmd == "list":
        _print([dict(r) for r in app.db.all("SELECT id, action, level, subject_type, subject_id, summary, created_at "
                                            "FROM approvals WHERE status='PENDENTE' ORDER BY id")])
    else:
        _print(permissions.decide(app, args.id, args.ap_cmd == "approve", note=args.note))
        generator.refresh_approvals(app)


def cmd_messages(app, args) -> None:
    sql = "SELECT id, lead_id, direction, kind, step, status, subject, error, created_at, sent_at FROM messages"
    params: tuple = ()
    if args.status:
        sql += " WHERE status=?"
        params = (args.status,)
    rows = [dict(r) for r in app.db.all(sql + " ORDER BY id DESC LIMIT ?", params + (args.limit,))]
    if args.show:
        row = app.db.one("SELECT subject, body, status, error FROM messages WHERE id=?", (args.show,))
        _print(dict(row) if row else None)
        return
    _print(rows)


def cmd_inbound(app, args) -> None:
    from .outreach import inbound
    if args.in_cmd == "poll":
        _print(inbound.poll_inbox(app))
    else:
        body = Path(args.body_file).read_text(encoding="utf-8") if args.body_file else args.body
        _print(inbound.register_inbound(app, from_address=args.sender, subject=args.subject or "", body=body or ""))


def cmd_proposal(app, args) -> None:
    from .proposals import generator
    if args.pr_cmd == "create":
        _print(generator.create_proposal(app, args.lead, args.service.upper(), args.discount))
    elif args.pr_cmd == "send":
        _print(generator.queue_send(app, args.id))
    elif args.pr_cmd == "outcome":
        generator.set_outcome(app, args.id, args.result == "aceita")
        _print({"ok": True})
    elif args.pr_cmd == "list":
        _print([dict(r) for r in app.db.all("SELECT * FROM proposals ORDER BY id DESC")])


def cmd_meeting(app, args) -> None:
    from .outreach import meetings
    if args.mt_cmd == "create":
        start = datetime.strptime(args.start, "%Y-%m-%d %H:%M").replace(tzinfo=TZ)
        _print(meetings.create_meeting(app, args.lead, start, duration_min=args.minutes, location=args.location))
    else:
        meetings.mark_held(app, args.id)
        _print({"ok": True})


def cmd_contract(app, args) -> None:
    from .crm import finance
    _print({"contract_id": finance.register_contract(
        app, lead_id=args.lead, proposal_id=args.proposal, total_value=args.total, monthly_value=args.monthly,
        recurring=args.recurring, signed_at=args.signed_at, owner_confirms_signature=args.confirm_signed)})


def cmd_finance(app, args) -> None:
    from .crm import finance
    _print({"entry_id": finance.add_entry(app, kind=args.kind, category=args.category, amount=args.amount,
                                          status=args.status, description=args.description or "",
                                          contract_id=args.contract, due_date=args.due, paid_at=args.paid_at)})


def cmd_report(app, args) -> None:
    from .analytics import reports
    md, js = reports.build(app, "diario" if args.kind == "daily" else "semanal")
    print(md.read_text(encoding="utf-8"))
    print(f"\nArquivos: {md} | {js}")


def cmd_kill(app, args) -> None:
    from .compliance import permissions
    if args.state in ("on", "off"):
        permissions.set_kill_switch(app, args.state == "on", args.reason or "")
    paused, why = permissions.is_paused(app)
    _print({"envios_pausados": paused, "motivo": why})


def cmd_lgpd(app, args) -> None:
    from .compliance import lgpd
    if args.lg_cmd == "export":
        _print(lgpd.export_subject(app, args.email))
    elif args.lg_cmd == "object":
        _print({"tarefas_canceladas": lgpd.object_to_processing(app, args.email)})
    elif args.lg_cmd == "delete":
        _print({"contatos_anonimizados": lgpd.erase_subject(app, args.email)})
    elif args.lg_cmd == "correct":
        _print({"atualizados": lgpd.correct_subject(app, args.email, args.field, args.value)})
    elif args.lg_cmd == "retention":
        _print(lgpd.apply_retention(app))
    elif args.lg_cmd == "suppress-domain":
        from .compliance import suppression
        _print({"adicionado": suppression.add_domain(app, args.domain, args.reason or "pedido do proprietário")})


def cmd_job(app, args) -> None:
    """Executa um job imediatamente (fora do agendamento)."""
    from .scheduler import job_table
    table = job_table(app)
    if args.name not in table:
        raise SystemExit(f"job desconhecido. Opções: {', '.join(table)}")
    _print(table[args.name]())


def cmd_daemon(app, args) -> None:
    from .scheduler import Scheduler
    Scheduler(app).serve_forever()


def cmd_run_once(app, args) -> None:
    from .scheduler import Scheduler
    sched = Scheduler(app)
    if not sched.acquire_lock():
        raise SystemExit("outro agendador está ativo")
    try:
        _print(sched.run_once())
    finally:
        sched.release_lock()


def cmd_stop(app, args) -> None:
    with app.db.transaction():
        app.db.set_meta("scheduler_stop_requested", "1")
    _print({"parada_solicitada": True, "obs": "o agendador encerra no próximo ciclo (até tick_seconds)"})


def cmd_backup(app, args) -> None:
    keep = int(app.settings.business.get("retention", {}).get("backups_keep", 14))
    _print({"backup": str(app.db.backup(app.settings.data_dir / "backups", keep))})


def cmd_api(_app, args) -> None:
    from .api.server import serve
    serve(lambda: build_app())


def cmd_powerbi(app, args) -> None:
    from .powerplatform import export
    _print(export.export_all(app))


def cmd_bridge(app, args) -> None:
    from .powerplatform import bridge
    _print(bridge.process_inbox(app))


def cmd_openapi(_app, args) -> None:
    from .api.openapi import build_spec
    spec = json.dumps(build_spec(host=args.host), ensure_ascii=False, indent=2)
    if args.output:
        Path(args.output).write_text(spec + "\n", encoding="utf-8")
        print(f"especificação gravada em {args.output}")
    else:
        print(spec)


def cmd_simulate(_app, args) -> None:
    from . import simulation
    _print(simulation.run())


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="python -m src.main", description="SST Autonomous Business Agent")
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("init", help="cria o banco e as pastas")
    sub.add_parser("status", help="situação geral")
    s = sub.add_parser("integrations", help="verifica integrações")
    s.add_argument("--offline", action="store_true", help="só verifica configuração, sem conectar")

    s = sub.add_parser("leads", help="leads")
    ls = s.add_subparsers(dest="leads_cmd", required=True)
    x = ls.add_parser("import"); x.add_argument("file")
    x = ls.add_parser("list"); x.add_argument("--status")
    x = ls.add_parser("show"); x.add_argument("id", type=int)
    x = ls.add_parser("score"); x.add_argument("id", type=int)
    x = ls.add_parser("transition", help="decisão humana (ex.: PERDIDO, BLOQUEADO)")
    x.add_argument("id", type=int); x.add_argument("to"); x.add_argument("--reason", required=True)

    s = sub.add_parser("approvals", help="fila de aprovações")
    aps = s.add_subparsers(dest="ap_cmd", required=True)
    aps.add_parser("list")
    for name in ("approve", "reject"):
        x = aps.add_parser(name); x.add_argument("id", type=int); x.add_argument("--note")

    s = sub.add_parser("messages", help="mensagens")
    s.add_argument("--status"); s.add_argument("--limit", type=int, default=30); s.add_argument("--show", type=int)

    s = sub.add_parser("inbound", help="respostas recebidas")
    ins = s.add_subparsers(dest="in_cmd", required=True)
    ins.add_parser("poll", help="lê a caixa IMAP")
    x = ins.add_parser("add", help="registra manualmente uma resposta")
    x.add_argument("--from", dest="sender", required=True); x.add_argument("--subject")
    x.add_argument("--body"); x.add_argument("--body-file")

    s = sub.add_parser("proposal", help="propostas")
    prs = s.add_subparsers(dest="pr_cmd", required=True)
    x = prs.add_parser("create"); x.add_argument("lead", type=int); x.add_argument("service")
    x.add_argument("--discount", type=float, default=0.0)
    x = prs.add_parser("send"); x.add_argument("id", type=int)
    x = prs.add_parser("outcome"); x.add_argument("id", type=int); x.add_argument("result", choices=["aceita", "recusada"])
    prs.add_parser("list")

    s = sub.add_parser("meeting", help="reuniões")
    mts = s.add_subparsers(dest="mt_cmd", required=True)
    x = mts.add_parser("create"); x.add_argument("lead", type=int); x.add_argument("start", help="'AAAA-MM-DD HH:MM'")
    x.add_argument("--minutes", type=int, default=30)
    x.add_argument("--location", default="Videochamada (link enviado na confirmação)")
    x = mts.add_parser("held"); x.add_argument("id", type=int)

    s = sub.add_parser("contract", help="registra contrato ASSINADO (pelo proprietário)")
    s.add_argument("--lead", type=int, required=True); s.add_argument("--proposal", type=int)
    s.add_argument("--total", type=float, required=True); s.add_argument("--monthly", type=float, default=0.0)
    s.add_argument("--recurring", action="store_true"); s.add_argument("--signed-at", required=True)
    s.add_argument("--confirm-signed", action="store_true", help="confirmo que o contrato foi assinado")

    s = sub.add_parser("finance", help="lançamento financeiro")
    s.add_argument("kind", choices=["RECEITA", "DESPESA"]); s.add_argument("amount", type=float)
    s.add_argument("--status", choices=["PREVISTO", "REALIZADO"], required=True)
    s.add_argument("--category", default="servico"); s.add_argument("--description")
    s.add_argument("--contract", type=int); s.add_argument("--due"); s.add_argument("--paid-at")

    s = sub.add_parser("report", help="relatório"); s.add_argument("kind", choices=["daily", "weekly"])
    s = sub.add_parser("kill-switch", help="pausa/retoma envios externos")
    s.add_argument("state", choices=["on", "off", "status"]); s.add_argument("--reason")

    s = sub.add_parser("lgpd", help="direitos do titular e retenção")
    lgs = s.add_subparsers(dest="lg_cmd", required=True)
    for name in ("export", "object", "delete"):
        x = lgs.add_parser(name); x.add_argument("email")
    x = lgs.add_parser("correct"); x.add_argument("email"); x.add_argument("field"); x.add_argument("value")
    lgs.add_parser("retention")
    x = lgs.add_parser("suppress-domain"); x.add_argument("domain"); x.add_argument("--reason")

    s = sub.add_parser("job", help="executa um job agora"); s.add_argument("name")
    sub.add_parser("daemon", help="inicia o agendador contínuo")
    sub.add_parser("run-once", help="executa os jobs devidos uma vez e sai")
    sub.add_parser("stop", help="pede ao agendador para encerrar")
    sub.add_parser("backup", help="backup do banco")
    sub.add_parser("simulate", help="simulação ponta a ponta sem envio externo")
    sub.add_parser("api", help="inicia a API REST + painel JavaScript (exige SST_API_TOKEN)")
    sub.add_parser("powerbi-export", help="exporta CSVs e painel.json para Power BI/Power Apps")
    sub.add_parser("bridge", help="processa comandos do Power Automate na pasta inbox/")
    s = sub.add_parser("openapi", help="gera a especificação do conector personalizado")
    s.add_argument("--host"); s.add_argument("--output")
    return p


HANDLERS = {
    "init": lambda app, args: _print({"banco": str(app.settings.db_path), "ok": True}),
    "status": cmd_status, "integrations": cmd_integrations, "leads": cmd_leads, "approvals": cmd_approvals,
    "messages": cmd_messages, "inbound": cmd_inbound, "proposal": cmd_proposal, "meeting": cmd_meeting,
    "contract": cmd_contract, "finance": cmd_finance, "report": cmd_report, "kill-switch": cmd_kill,
    "lgpd": cmd_lgpd, "job": cmd_job, "daemon": cmd_daemon, "run-once": cmd_run_once, "stop": cmd_stop,
    "backup": cmd_backup, "simulate": cmd_simulate, "powerbi-export": cmd_powerbi, "bridge": cmd_bridge,
}


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    # Carrega o .env antes de qualquer comando (api/openapi leem o ambiente sem passar por build_app).
    from . import settings as settings_module
    settings_module.load_dotenv(settings_module.BASE_DIR / ".env")
    if args.cmd in ("simulate", "api", "openapi"):
        try:
            {"simulate": cmd_simulate, "api": cmd_api, "openapi": cmd_openapi}[args.cmd](None, args)
        except RuntimeError as exc:
            print(f"erro: {exc}", file=sys.stderr)
            return 2
        return 0
    app = build_app()
    try:
        HANDLERS[args.cmd](app, args)
    except (ValueError, KeyError, RuntimeError) as exc:
        app.log.error("%s", exc)
        return 2
    finally:
        app.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
