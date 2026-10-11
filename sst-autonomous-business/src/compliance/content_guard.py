"""Bloqueia alegações proibidas em mensagens externas (falsa auditoria, falsa indicação etc.)."""
from __future__ import annotations

import re

REQUIRED_OPTOUT_HINT = re.compile(r"descadastr", re.I)
PLACEHOLDER_RE = re.compile(r"\{\{\s*[\w.]+\s*\}\}|CONFIGURAR")


def violations(settings, text: str, *, require_optout: bool = True) -> list[str]:
    found: list[str] = []
    for rule in settings.outreach.get("forbidden_claims", []):
        if re.search(rule["pattern"], text, re.I):
            found.append(rule["reason"])
    if PLACEHOLDER_RE.search(text):
        found.append("Mensagem contém campo não preenchido ({{...}} ou CONFIGURAR)")
    if require_optout and not REQUIRED_OPTOUT_HINT.search(text):
        found.append("Mensagem sem instrução de descadastro")
    return found
