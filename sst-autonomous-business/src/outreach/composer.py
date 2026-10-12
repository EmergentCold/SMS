"""Renderização de modelos aprovados (templates/*.md) com variáveis obrigatórias."""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

VAR_RE = re.compile(r"\{\{\s*([\w.]+)\s*\}\}")
VARIANT_RE = re.compile(r"<!--\s*variant:\s*([\w\-]+)\s*-->")
COMMENT_RE = re.compile(r"<!--.*?-->", re.S)
OPTIONAL_VARS = {"digital_line"}  # podem ficar vazias


class TemplateError(ValueError):
    pass


@dataclass
class Rendered:
    subject: str
    body: str


def render_text(text: str, variables: dict) -> str:
    def repl(match: re.Match) -> str:
        key = match.group(1)
        value = variables.get(key)
        if key in OPTIONAL_VARS and value is not None:
            return str(value)
        if value is None or value == "":
            raise TemplateError(f"variável obrigatória ausente: {key}")
        return str(value)
    return VAR_RE.sub(repl, text)


def load_variants(path: Path) -> dict[str, str]:
    text = path.read_text(encoding="utf-8")
    parts = VARIANT_RE.split(text)
    variants = {}
    for i in range(1, len(parts), 2):
        variants[parts[i]] = COMMENT_RE.sub("", parts[i + 1]).strip()
    return variants


def render_message(templates_dir: Path, template: str, variant: str, variables: dict) -> Rendered:
    variants = load_variants(templates_dir / f"{template}.md")
    if variant not in variants:
        raise TemplateError(f"variante '{variant}' não existe em {template}.md")
    block = variants[variant]
    header, sep, body = block.partition("\n---\n")
    if not sep or not header.strip().lower().startswith("assunto:"):
        raise TemplateError(f"{template}.md/{variant}: formato inválido (esperado 'Assunto:' e '---')")
    subject = render_text(header.split(":", 1)[1].strip(), variables)
    body = render_text(body.strip(), variables)
    body = re.sub(r"\n{3,}", "\n\n", body)
    return Rendered(subject=subject, body=body + "\n")


def base_variables(app, lead: dict, contact: dict | None) -> dict:
    """Variáveis comuns: identidade do remetente, saudação, gancho do segmento, origem e descadastro."""
    s = app.settings
    owner, brand = s.business.get("owner", {}), s.business.get("brand", {})
    hooks = s.outreach.get("segment_hooks", {})
    hook = hooks.get(lead.get("segment") or "desconhecido") or hooks.get("desconhecido", "")
    contact_name = (contact or {}).get("name")
    greeting = f"Olá, {contact_name.split()[0]}," if contact_name else "Olá,"
    commercial_email = brand.get("commercial_email") or "CONFIGURAR"
    trade = brand.get("trade_name") or "CONFIGURAR"
    signature_lines = [owner.get("name") or "CONFIGURAR", owner.get("professional_title") or ""]
    if owner.get("registration_verified") and owner.get("registration_number"):
        signature_lines.append(f"Registro profissional: {owner['registration_number']}")
    if trade and trade != owner.get("name"):
        signature_lines.append(trade)
    signature_lines.append(commercial_email)
    if brand.get("phone"):
        signature_lines.append(brand["phone"])
    source = (contact or {}).get("source_description") or (contact or {}).get("source_url") or "fonte registrada no CRM"
    catalog = s.services.get("services", {})
    services = lead.get("services") or []
    remote_only = bool(services) and all(catalog.get(c, {}).get("delivery") in ("remoto", "hibrido") for c in services)
    if lead.get("segment") == "consultoria_sst":
        oferta = ("por exemplo, uma demonstração online de 15 minutos da planilha de vencimentos e do gerador de "
                  "crachás, para avaliar se faz sentido para os clientes de vocês")
        abrangencia = "atendo empresas de todo o Brasil de forma remota"
    elif remote_only:
        oferta = ("por exemplo, a gestão documental de SST dos prestadores de serviço ou um painel mensal de "
                  "indicadores de segurança, feitos de forma remota")
        abrangencia = "atendo empresas de todo o Brasil de forma remota (e presencialmente em Guarulhos, São Paulo e região)"
    else:
        oferta = "por exemplo, um diagnóstico preliminar com plano de ação priorizado"
        abrangencia = "atendo empresas de Guarulhos, São Paulo e região"
    return {
        "greeting": greeting,
        "company_name": lead.get("company_name"),
        "owner_name": owner.get("name"),
        "owner_title": owner.get("professional_title"),
        "brand_name": trade,
        "segment_hook": hook,
        "segment_hook_lower": hook[:1].lower() + hook[1:] if hook else hook,
        "source_description": source,
        "oferta": oferta,
        "digital_line": "" if lead.get("segment") == "consultoria_sst" else s.outreach.get("digital_line", ""),
        "abrangencia": abrangencia,
        "commercial_email": commercial_email,
        "signature": "\n".join(x for x in signature_lines if x),
        "optout_line": "Se não quiser receber novas mensagens, responda \"descadastrar\" e removo seu contato imediatamente.",
    }
