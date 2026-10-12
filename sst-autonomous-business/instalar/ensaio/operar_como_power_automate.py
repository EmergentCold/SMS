"""Opera o agente instalado como o Power Automate/Power Apps fariam: só grava JSON na pasta do OneDrive
(inbox/) e lê o que o agente devolve (outbox/, export/painel.json, aprovacoes/). O processamento é feito
pelo daemon em segundo plano (job powerplatform_inbox, a cada minuto)."""
import json
import os
import sys
import time
import urllib.request
import uuid
from pathlib import Path

projeto = Path(sys.argv[1])
env = dict(l.split("=", 1) for l in (projeto / ".env").read_text(encoding="utf-8").splitlines()
           if "=" in l and not l.lstrip().startswith("#"))
ponte = Path(env["POWERPLATFORM_DIR"].strip())
token = env["SST_BRIDGE_TOKEN"].strip()
api_token = env["SST_API_TOKEN"].strip()


def comando(dados: dict, com_token: bool = True) -> str:
    cid = uuid.uuid4().hex
    corpo = {"id": cid, "by": "dono@empresa.test", **dados}
    if com_token:
        corpo["token"] = token
    tmp = ponte / "inbox" / f"{cid}.tmp"
    tmp.write_text(json.dumps(corpo, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, ponte / "inbox" / f"{cid}.json")  # como o "Criar arquivo" do OneDrive
    return cid


def esperar_resultado(cid: str, limite: float = 150) -> dict:
    alvo = ponte / "outbox" / f"{cid}.result.json"
    inicio = time.time()
    while time.time() - inicio < limite:
        if alvo.exists():
            r = json.loads(alvo.read_text(encoding="utf-8"))
            print(f"    processado pelo agente em {time.time() - inicio:.0f}s → {r['status']}")
            return r
        time.sleep(2)
    raise SystemExit(f"FALHA: agente não processou {cid} em {limite}s")


def painel() -> dict:
    return json.loads((ponte / "export" / "painel.json").read_text(encoding="utf-8"))


def api(metodo: str, caminho: str, corpo: dict | None = None):
    req = urllib.request.Request("http://127.0.0.1:8765" + caminho, method=metodo,
                                 data=None if corpo is None else json.dumps(corpo).encode(),
                                 headers={"Authorization": f"Bearer {api_token}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())


print("1) Fluxo 7 (Excel → agente): importar 3 leads de teste (domínios .test, com origem)")
linhas = [
    {"name": "ENSAIO Transportes Guarulhos", "website": "https://ensaio-transportes.test", "segment": "transportadora",
     "city": "Guarulhos", "contact_email": "contato@ensaio-transportes.test",
     "source_url": "https://ensaio-transportes.test/contato", "facts": "expansao: site menciona nova unidade"},
    {"name": "ENSAIO CD Cajamar", "website": "https://ensaio-cd.test", "segment": "centro_distribuicao",
     "city": "Cajamar", "contact_email": "comercial@ensaio-cd.test", "source_url": "https://ensaio-cd.test/contato",
     "facts": "maquinas: site menciona empilhadeiras"},
    {"name": "ENSAIO Sem Origem", "website": "https://ensaio-sem-origem.test", "segment": "industria"},
]
r = esperar_resultado(comando({"type": "leads_import", "rows": linhas}))
print("    resultado:", {k: r["resultado"][k] for k in ("empresas_novas", "rejeitadas", "erros")})
assert r["resultado"]["empresas_novas"] == 2 and r["resultado"]["rejeitadas"] == 1

print("2) Comando sem o token da ponte deve ser recusado")
r = esperar_resultado(comando({"type": "kill_switch", "on": True}, com_token=False))
assert r["status"] == "erro" and "token" in r["erro"], r

print("3) Painel/Power Apps: rodar qualificação e prospecção (botões 'Rotinas')")
print("    qualificação:", api("POST", "/api/jobs/qualify", {"by": "power-apps"})["resultado"])
print("    prospecção:", api("POST", "/api/jobs/outreach", {"by": "power-apps"})["resultado"])

print("4) Fluxo 3: arquivos de aprovação para o Teams aparecem em aprovacoes/")
inicio = time.time()
while time.time() - inicio < 150 and len(list((ponte / "aprovacoes").glob("aprovacao-*.json"))) < 2:
    time.sleep(2)
arquivos = sorted((ponte / "aprovacoes").glob("aprovacao-*.json"))
print(f"    {len(arquivos)} arquivo(s) em {time.time() - inicio:.0f}s:", [json.loads(a.read_text())["titulo"][:80] for a in arquivos])
assert len(arquivos) == 2

print("5) Fluxo 3: você aprova o 1º no Teams e rejeita o 2º")
ap1, ap2 = (json.loads(a.read_text()) for a in arquivos)
r1 = esperar_resultado(comando({"type": "approval_decision", "approval_id": ap1["id"], "approve": True, "note": "ok"}))
r2 = esperar_resultado(comando({"type": "approval_decision", "approval_id": ap2["id"], "approve": False,
                                "note": "ajustar texto"}))
print("    decisões:", r1["resultado"], r2["resultado"])
envios = api("POST", "/api/jobs/outreach", {"by": "power-apps"})["resultado"]["envios"]
print("    tentativa de envio após aprovação:", envios)
msgs = api("GET", "/api/messages")
print("    mensagens:", [(m["id"], m["status"], m["error"]) for m in msgs if m["direction"] == "OUT"])
assert not any(m["status"] == "ENVIADA" for m in msgs), "nenhum e-mail pode sair com envio externo desligado"

print("6) Fluxo 4 (Outlook → agente): prospect responde com interesse")
lead = next(l for l in api("GET", "/api/leads") if l["empresa"].startswith("ENSAIO CD"))
r = esperar_resultado(comando({"type": "inbound_message", "from": "comercial@ensaio-cd.test", "subject": "Re: Apoio",
                               "body": "Temos interesse, podemos conversar semana que vem?",
                               "message_id": "<ensaio-1@ensaio-cd.test>"}))
print("    intenção:", r["resultado"]["intent"], "| ações:", r["resultado"]["acoes"])
print("    estado do lead:", api("GET", f"/api/leads/{lead['id']}")["status"])

print("7) Fluxo 6 (botão do celular): pausar envios e retomar")
esperar_resultado(comando({"type": "kill_switch", "on": True, "reason": "teste do botão"}))
print("    painel.json → kill switch:", painel()["kill_switch"])
assert painel()["kill_switch"]["ativo"] is True
esperar_resultado(comando({"type": "kill_switch", "on": False}))
assert painel()["kill_switch"]["ativo"] is False
print("    retomado")

print("8) Fluxo 1 (Power Apps lê o painel): resumo com nomes simples para Power Fx")
p = painel()
print("    resumo:", {k: p["resumo"][k] for k in ("leads_qualificados", "mensagens_enviadas", "contratos")},
      "| aprovações pendentes:", len(p["aprovacoes"]), "| leads:", len(p["leads"]))
print("\nENSAIO OK")
