"""Normalização e validação de identificadores usados na deduplicação."""
from __future__ import annotations

import re
from urllib.parse import urlparse

EMAIL_RE = re.compile(r"^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$", re.I)

_MULTI_PART_TLDS = {"com.br", "net.br", "org.br", "ind.br", "eng.br", "log.br", "srv.br", "emp.br", "co.uk"}


def normalize_domain(value: str | None) -> str | None:
    """'https://www.Empresa.com.br/contato' -> 'empresa.com.br'."""
    if not value:
        return None
    value = value.strip().lower()
    if "@" in value and "/" not in value:
        value = value.split("@", 1)[1]
    if "://" not in value:
        value = "http://" + value
    host = urlparse(value).hostname or ""
    host = host.strip(".")
    if host.startswith("www."):
        host = host[4:]
    return host or None


def registrable_domain(host: str | None) -> str | None:
    """Reduz subdomínios: 'loja.empresa.com.br' -> 'empresa.com.br'."""
    if not host:
        return None
    parts = host.split(".")
    if len(parts) >= 3 and ".".join(parts[-2:]) in _MULTI_PART_TLDS:
        return ".".join(parts[-3:])
    if len(parts) >= 2:
        return ".".join(parts[-2:])
    return host


def company_domain(website: str | None) -> str | None:
    return registrable_domain(normalize_domain(website))


def cnpj_digits(value: str | None) -> str | None:
    if not value:
        return None
    digits = re.sub(r"\D", "", value)
    return digits if len(digits) == 14 else None


def cnpj_is_valid(value: str | None) -> bool:
    digits = cnpj_digits(value)
    if not digits or digits == digits[0] * 14:
        return False

    def check_digit(base: str, weights: list[int]) -> str:
        total = sum(int(d) * w for d, w in zip(base, weights))
        rest = total % 11
        return "0" if rest < 2 else str(11 - rest)

    w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    w2 = [6] + w1
    d1 = check_digit(digits[:12], w1)
    d2 = check_digit(digits[:12] + d1, w2)
    return digits[-2:] == d1 + d2


def normalize_cnpj(value: str | None) -> str | None:
    """Retorna somente os 14 dígitos de um CNPJ válido; inválido -> None."""
    return cnpj_digits(value) if cnpj_is_valid(value) else None


def email_is_valid(email: str | None) -> bool:
    return bool(email and EMAIL_RE.match(email.strip()))


def normalize_name(name: str | None) -> str:
    name = (name or "").lower()
    name = re.sub(r"\b(ltda|eireli|s\.?a\.?|me|epp|cia|comercio|comércio|servicos|serviços)\b", " ", name)
    return re.sub(r"[^a-z0-9à-ú]+", " ", name).strip()
