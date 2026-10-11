"""Lista de supressão: impede novos contatos com quem pediu para sair.

Guarda apenas o hash SHA-256 do e-mail/telefone normalizado (minimização) e
uma versão mascarada para leitura humana.
"""
from __future__ import annotations

import hashlib
import re

from ..settings import iso


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def normalize_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone or "")
    if digits.startswith("55") and len(digits) in (12, 13):
        return digits
    if len(digits) in (10, 11):
        return "55" + digits
    return digits


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def mask_email(email: str) -> str:
    email = normalize_email(email)
    if "@" not in email:
        return "***"
    local, domain = email.split("@", 1)
    return (local[:2] + "***@" + domain) if local else "***@" + domain


def _add(app, kind: str, value: str, display: str, reason: str) -> bool:
    db = app.db
    with db.transaction():
        cur = db.execute("INSERT OR IGNORE INTO suppression(kind, value_hash, display, reason, created_at) "
                         "VALUES (?, ?, ?, ?, ?)", (kind, _hash(value), display, reason, iso()))
        if cur.rowcount:
            db.audit("supressao_adicionada", "suppression", None, {"kind": kind, "display": display, "reason": reason})
    return bool(cur.rowcount)


def add_email(app, email: str, reason: str) -> bool:
    email = normalize_email(email)
    return _add(app, "email", email, mask_email(email), reason)


def add_domain(app, domain: str, reason: str) -> bool:
    domain = (domain or "").strip().lower()
    return _add(app, "domain", domain, domain, reason)


def add_phone(app, phone: str, reason: str) -> bool:
    phone = normalize_phone(phone)
    return _add(app, "phone", phone, phone[:4] + "****" + phone[-2:], reason)


def is_suppressed(app, email: str | None = None, phone: str | None = None) -> tuple[bool, str]:
    db = app.db
    if email:
        email = normalize_email(email)
        if db.one("SELECT 1 FROM suppression WHERE kind='email' AND value_hash=?", (_hash(email),)):
            return True, "e-mail na lista de supressão"
        domain = email.split("@", 1)[-1]
        if db.one("SELECT 1 FROM suppression WHERE kind='domain' AND value_hash=?", (_hash(domain),)):
            return True, "domínio na lista de supressão"
    if phone and db.one("SELECT 1 FROM suppression WHERE kind='phone' AND value_hash=?",
                        (_hash(normalize_phone(phone)),)):
        return True, "telefone na lista de supressão"
    return False, ""
