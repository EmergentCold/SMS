"""Base dos adaptadores: status, pendências de configuração e controle de custo."""
from __future__ import annotations

from dataclasses import dataclass

from ..settings import iso, now


class NotConfigured(RuntimeError):
    """Integração sem credencial/configuração. Nunca simular sucesso."""


class BudgetExceeded(RuntimeError):
    pass


@dataclass
class IntegrationStatus:
    name: str
    configured: bool
    verified: bool | None
    detail: str
    action_needed: str | None = None


def record_pending(app, name: str, reason: str, action_needed: str | None = None) -> None:
    db = app.db
    with db.transaction():
        db.execute(
            "INSERT INTO pending_integrations(name, reason, action_needed, first_seen, last_seen, occurrences) "
            "VALUES (?, ?, ?, ?, ?, 1) ON CONFLICT(name) DO UPDATE SET reason=excluded.reason, "
            "action_needed=excluded.action_needed, last_seen=excluded.last_seen, occurrences=occurrences+1",
            (name, reason, action_needed, iso(), iso()))


def clear_pending(app, name: str) -> None:
    with app.db.transaction():
        app.db.execute("DELETE FROM pending_integrations WHERE name=?", (name,))


def track_usage(app, integration: str, cost: float = 0.0) -> None:
    """Contabiliza chamadas e custo estimado; bloqueia ao estourar o orçamento mensal."""
    budget = float(app.settings.business.get("costs", {}).get("monthly_budget_brl", 0) or 0)
    month = now().strftime("%Y-%m")
    spent = app.db.scalar("SELECT COALESCE(SUM(est_cost),0) FROM integration_usage WHERE day LIKE ?", (month + "%",))
    if budget and spent + cost > budget:
        raise BudgetExceeded(f"orçamento mensal de ferramentas (R$ {budget:.2f}) atingido")
    day = now().strftime("%Y-%m-%d")
    with app.db.transaction():
        app.db.execute("INSERT INTO integration_usage(integration, day, calls, est_cost) VALUES (?, ?, 1, ?) "
                       "ON CONFLICT(integration, day) DO UPDATE SET calls=calls+1, est_cost=est_cost+excluded.est_cost",
                       (integration, day, cost))
