"""Preenche a identidade do proprietário em config/business.json (usado pelo instalador do Windows).

Uso: python instalar/configurar_identidade.py --nome "Fulano" --marca "Fulano SST" --email contato@dominio.com.br
Só altera os campos informados; não inventa registro profissional nem certificações.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

EMAIL_RE = re.compile(r"^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$", re.I)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", default=str(Path(__file__).resolve().parent.parent / "config" / "business.json"))
    parser.add_argument("--nome")
    parser.add_argument("--marca")
    parser.add_argument("--email")
    parser.add_argument("--telefone")
    parser.add_argument("--site")
    parser.add_argument("--horas-semana", type=int)
    parser.add_argument("--contratos-max", type=int)
    args = parser.parse_args(argv)

    path = Path(args.config)
    data = json.loads(path.read_text(encoding="utf-8"))
    owner, brand, capacity = data["owner"], data["brand"], data["capacity"]
    if args.email and not EMAIL_RE.match(args.email.strip()):
        print(f"e-mail inválido: {args.email}", file=sys.stderr)
        return 2
    if args.nome:
        owner["name"] = args.nome.strip()
    if args.marca:
        brand["trade_name"] = args.marca.strip()
    if args.email:
        brand["commercial_email"] = args.email.strip().lower()
    if args.telefone:
        brand["phone"] = args.telefone.strip()
    if args.site:
        brand["website"] = args.site.strip()
    if args.horas_semana is not None:
        capacity["hours_per_week"] = max(0, args.horas_semana)
        capacity["verified"] = True
    if args.contratos_max is not None:
        capacity["max_active_contracts"] = max(0, args.contratos_max)
        capacity["verified"] = True
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    pronto = owner.get("name") not in (None, "", "CONFIGURAR") and bool(brand.get("commercial_email"))
    print("identidade configurada" if pronto else "identidade ainda incompleta (nome e e-mail comercial)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
