"""Simulação ponta a ponta SEM envio externo.

Usa banco separado (data/simulation.db), empresas FICTÍCIAS em domínios reservados (TLD .test,
RFC 2606) e um canal que grava as mensagens em data/simulation_outbox/. Nenhuma conexão de rede é feita.
"""
from __future__ import annotations

import shutil
from datetime import datetime, timedelta

from .app import build_app
from .analytics import reports
from .compliance import lgpd, permissions
from .crm import finance, repository, scoring
from .outreach import followup, inbound, meetings, sender
from .proposals import generator
from .settings import TZ, clock

FICTITIOUS = [
    # nome, site, segmento, cidade, porte, e-mail, fatos
    ("EXEMPLO Transportes Fictícios", "https://transportes-ficticios.test", "transportadora", "Guarulhos", "media",
     "contato@transportes-ficticios.test", ["expansao: (fictício) site menciona nova unidade em Guarulhos"]),
    ("EXEMPLO CD Logística Simulada", "https://cdlog-simulado.test", "centro_distribuicao", "Cajamar", "media",
     "comercial@cdlog-simulado.test", ["maquinas: (fictício) site menciona operação com empilhadeiras",
                                     "terceiros: (fictício) site menciona homologação de fornecedores"]),
    ("EXEMPLO Indústria de Teste", "https://industria-teste.test", "industria", "São Paulo", "pequena",
     "contato@industria-teste.test", []),
    ("EXEMPLO Manutenção Demonstrativa", "https://manutencao-demo.test", "manutencao", "Campinas", "micro",
     None, []),
]


def run(base_dir=None, fresh: bool = True) -> dict:
    app = build_app(base_dir, simulation=True)
    s = app.settings
    if fresh:
        app.close()
        for suffix in ("", "-wal", "-shm"):
            (s.db_path.parent / (s.db_path.name + suffix)).unlink(missing_ok=True)
        shutil.rmtree(s.data_dir / "simulation_outbox", ignore_errors=True)
        app = build_app(base_dir, simulation=True)
        s = app.settings
    # Identidade fictícia apenas em memória (não altera config/business.json).
    s.business["owner"]["name"] = "Proprietário Simulado"
    s.business["brand"]["commercial_email"] = "simulacao@example.com"
    s.business["brand"]["trade_name"] = "SST Simulação"
    s.business["capacity"]["max_active_contracts"] = max(1, s.business["capacity"].get("max_active_contracts", 1))
    # Preço fictício somente para demonstrar o fluxo; o arquivo de preços real não é alterado.
    s.pricing["services"]["A"] = {"status": "aprovado", "unit": "projeto", "list_price": 1000.0, "min_price": 900.0,
                                  "max_discount_pct": 5, "operational_cost": 200.0}
    s.pricing["defaults"]["payment_terms"] = "(fictício) 50% no aceite e 50% na entrega"
    log: list[str] = []

    clock.set(datetime(2026, 10, 13, 9, 30, tzinfo=TZ))  # terça-feira, horário comercial
    try:
        source = lgpd.register_source(app, "simulacao", "DADOS FICTÍCIOS para simulação (TLD .test, RFC 2606)")
        for name, site, seg, city, size, email, facts in FICTITIOUS:
            res = repository.upsert_company(app, name=name, website=site, segment=seg, city=city, state="SP",
                                            size_estimate=size, size_source="fictício", source_id=source,
                                            is_simulation=True)
            repository.ensure_lead(app, res.company_id)
            if email:
                repository.add_contact(app, res.company_id, email=email, contact_type="generic_corporate",
                                       source_id=source, source_url=site, legal_basis="legitimo_interesse")
            for fact in facts:
                tag, _, text = fact.partition(":")
                repository.add_evidence(app, res.company_id, kind="FATO", tag=tag, statement=text.strip(),
                                        source_id=source, url=site)
        dup = repository.upsert_company(app, name="Exemplo Transportes (duplicado)", website="http://www.transportes-ficticios.test/contato",
                                        source_id=source, is_simulation=True)
        log.append(f"Duplicata bloqueada: {not dup.created} (casou por {dup.matched_by})")

        log.append(f"Qualificação: {scoring.qualify_pending(app)}")
        log.append(f"Prospecção (1ª rodada, autonomia padrão): {sender.run_outreach(app)}")
        pend = app.db.all("SELECT id FROM approvals WHERE status='PENDENTE' AND action='send_first_contact'")
        log.append(f"Aprovações pendentes de contato inicial: {len(pend)}")
        for row in pend:
            permissions.decide(app, row["id"], True, by="proprietario(simulado)")
        log.append(f"Envios após aprovação: {sender.dispatch_pending(app)}")

        clock.set(datetime(2026, 10, 16, 10, 0, tzinfo=TZ))  # D+3
        log.append(f"Follow-ups D+3: {followup.run_due(app)}")

        lead_cd = app.db.scalar("SELECT l.id FROM leads l JOIN companies c ON c.id=l.company_id WHERE c.domain='cdlog-simulado.test'")
        lead_tr = app.db.scalar("SELECT l.id FROM leads l JOIN companies c ON c.id=l.company_id WHERE c.domain='transportes-ficticios.test'")
        r1 = inbound.register_inbound(app, from_address="comercial@cdlog-simulado.test", subject="Re: Apoio",
                                      body="Olá, temos interesse. Podemos conversar na semana que vem?",
                                      message_id="<sim-1@cdlog-simulado.test>")
        log.append(f"Resposta positiva (CD): {r1['intent']} → {r1['acoes']}")
        r2 = inbound.register_inbound(app, from_address="contato@transportes-ficticios.test", subject="Re: Apoio",
                                      body="Por favor, descadastrar nosso e-mail.", message_id="<sim-2@transportes-ficticios.test>")
        log.append(f"Pedido de descadastro (Transportes): {r2['intent']} → {r2['acoes']}")

        clock.set(datetime(2026, 10, 20, 10, 0, tzinfo=TZ))  # D+7
        log.append(f"Follow-ups D+7 (devem ser cancelados p/ quem respondeu): {followup.run_due(app)}")

        permissions.decide(app, app.db.scalar("SELECT id FROM approvals WHERE status='PENDENTE' "
                                              "AND action='send_reply' ORDER BY id LIMIT 1"), True,
                           by="proprietario(simulado)")
        log.append(f"Resposta ao interessado: {sender.dispatch_pending(app)}")
        mt = meetings.create_meeting(app, lead_cd, datetime(2026, 10, 22, 14, 0, tzinfo=TZ))
        approval = app.db.scalar("SELECT id FROM approvals WHERE status='PENDENTE' AND action='schedule_meeting'")
        if approval:
            permissions.decide(app, approval, True, by="proprietario(simulado)")
            sender.dispatch(app, mt["message_id"])
        log.append(f"Reunião: #{mt['meeting_id']} convite {mt['ics']}")

        pending = generator.create_proposal(app, lead_cd, "B")
        log.append(f"Proposta serviço B (sem preço aprovado): {pending['status']}")
        prop = generator.create_proposal(app, lead_cd, "A")
        log.append(f"Proposta serviço A (preço fictício aprovado): {prop['status']} → {prop['arquivo']}")
        try:
            generator.queue_send(app, pending["proposal_id"])
        except generator.ProposalError as exc:
            log.append(f"Envio da proposta pendente bloqueado: {exc}")
        q = generator.queue_send(app, prop["proposal_id"])
        appr = app.db.scalar("SELECT id FROM approvals WHERE status='PENDENTE' AND action='send_proposal'")
        if appr:
            permissions.decide(app, appr, True, by="proprietario(simulado)")
            q = sender.dispatch(app, q["message_id"]).__dict__
        log.append(f"Envio da proposta A: {q}")

        clock.set(datetime(2026, 10, 27, 10, 0, tzinfo=TZ))
        contract = finance.register_contract(app, lead_id=lead_cd, proposal_id=prop["proposal_id"], total_value=1000.0,
                                             monthly_value=0.0, recurring=False, signed_at="2026-10-27",
                                             owner_confirms_signature=True)
        finance.add_entry(app, kind="RECEITA", category="servico", amount=500.0, status="REALIZADO",
                          contract_id=contract, paid_at="2026-10-27", description="(fictício) 50% na aprovação")
        finance.add_entry(app, kind="RECEITA", category="servico", amount=500.0, status="PREVISTO",
                          contract_id=contract, due_date="2026-11-10", description="(fictício) 50% na entrega")
        log.append(f"Contrato registrado pelo proprietário (simulado): #{contract}")

        permissions.set_kill_switch(app, True, "teste de interrupção na simulação")
        log.append(f"Kill switch ATIVO + follow-up D+14 devido: {followup.run_due(app)}")
        held = app.db.all("SELECT id, status, error FROM messages WHERE status='PRONTA'")
        log.append(f"Mensagens retidas pelo kill switch: {[dict(r) for r in held]}")
        permissions.set_kill_switch(app, False)
        log.append(f"Kill switch desligado → envios: {sender.dispatch_pending(app)}")

        clock.set(datetime(2026, 11, 20, 10, 0, tzinfo=TZ))
        log.append(f"Encerramento de sequências sem resposta: {followup.run_due(app)}")
        md, _ = reports.build(app, "semanal")
        log.append(f"Relatório: {md}")
        statuses = {r["name"]: r["status"] for r in app.db.all(
            "SELECT c.name, l.status FROM leads l JOIN companies c ON c.id=l.company_id")}
        outbox = sorted(p.name for p in (s.data_dir / "simulation_outbox").glob("*.json"))
        return {"passos": log, "estados_finais": statuses, "arquivos_outbox": outbox, "relatorio": str(md),
                "transportes_lead": lead_tr}
    finally:
        clock.set(None)
        app.close()
