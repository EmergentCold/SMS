"""Banco SQLite do CRM: esquema, transações, auditoria e backups.

O SQL usa apenas tipos e construções portáveis (TEXT/INTEGER/REAL, chaves
estrangeiras, índices únicos) para facilitar migração futura a PostgreSQL.
Datas são TEXT em ISO 8601 com offset de America/Sao_Paulo.
"""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

from .settings import iso, now

SCHEMA_VERSION = 1

SCHEMA = """
CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS data_sources (
    id INTEGER PRIMARY KEY,
    kind TEXT NOT NULL,                 -- site_oficial, busca_api, csv_proprietario, api_publica, inbound, indicacao
    url TEXT,
    description TEXT NOT NULL,
    retrieved_at TEXT NOT NULL,
    purpose TEXT NOT NULL DEFAULT 'prospeccao_b2b_sst',
    terms_note TEXT
);

CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    legal_name TEXT,
    cnpj TEXT UNIQUE,
    domain TEXT UNIQUE,
    website TEXT,
    segment TEXT NOT NULL DEFAULT 'desconhecido',
    segment_confidence TEXT NOT NULL DEFAULT 'baixa',
    city TEXT,
    state TEXT,
    size_estimate TEXT NOT NULL DEFAULT 'desconhecido',
    size_source TEXT,
    size_confidence TEXT NOT NULL DEFAULT 'baixa',
    source_id INTEGER REFERENCES data_sources(id),
    is_simulation INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    name TEXT,
    role TEXT,
    email TEXT UNIQUE,
    phone TEXT,
    contact_type TEXT NOT NULL,          -- generic_corporate, named_professional, inbound_request, referral_authorized
    source_id INTEGER REFERENCES data_sources(id),
    source_url TEXT,
    legal_basis TEXT,                    -- legitimo_interesse, consentimento, solicitacao_titular
    legal_basis_note TEXT,
    status TEXT NOT NULL DEFAULT 'ATIVO', -- ATIVO, INVALIDO, OPOSICAO, ANONIMIZADO
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evidence (
    id INTEGER PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    source_id INTEGER REFERENCES data_sources(id),
    kind TEXT NOT NULL CHECK (kind IN ('FATO', 'HIPOTESE')),
    tag TEXT,
    statement TEXT NOT NULL,
    excerpt TEXT,
    url TEXT,
    confidence TEXT NOT NULL DEFAULT 'media',
    collected_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY,
    company_id INTEGER NOT NULL UNIQUE REFERENCES companies(id),
    status TEXT NOT NULL DEFAULT 'PESQUISADO',
    prior_status TEXT,
    score INTEGER,
    score_breakdown TEXT,
    priority TEXT,
    services TEXT,
    next_action TEXT,
    next_action_at TEXT,
    lost_reason TEXT,
    first_contact_at TEXT,
    won_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lead_events (
    id INTEGER PRIMARY KEY,
    lead_id INTEGER NOT NULL REFERENCES leads(id),
    from_status TEXT,
    to_status TEXT NOT NULL,
    evidence_type TEXT,
    evidence_ref TEXT,
    reason TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    segment TEXT,
    channel TEXT NOT NULL DEFAULT 'email',
    status TEXT NOT NULL DEFAULT 'ATIVA',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id),
    contact_id INTEGER REFERENCES contacts(id),
    campaign_id INTEGER REFERENCES campaigns(id),
    direction TEXT NOT NULL CHECK (direction IN ('OUT', 'IN')),
    channel TEXT NOT NULL,
    kind TEXT NOT NULL,                  -- first_contact, followup, reply, proposal, meeting, inbound
    step INTEGER,
    subject TEXT,
    body TEXT,
    status TEXT NOT NULL,
    idempotency_key TEXT UNIQUE,
    provider_message_id TEXT,
    in_reply_to TEXT,
    intent TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    sent_at TEXT
);

CREATE TABLE IF NOT EXISTS consents (
    id INTEGER PRIMARY KEY,
    contact_id INTEGER NOT NULL REFERENCES contacts(id),
    purpose TEXT NOT NULL,
    legal_basis TEXT NOT NULL,
    status TEXT NOT NULL,                -- ATIVO, REVOGADO
    evidence TEXT,
    recorded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS suppression (
    id INTEGER PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('email', 'domain', 'phone')),
    value_hash TEXT NOT NULL,
    display TEXT,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (kind, value_hash)
);

CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id),
    kind TEXT NOT NULL,
    due_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDENTE', -- PENDENTE, EM_EXECUCAO, CONCLUIDA, CANCELADA, FALHOU
    payload TEXT,
    dedupe_key TEXT UNIQUE,
    result TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS approvals (
    id INTEGER PRIMARY KEY,
    action TEXT NOT NULL,
    level INTEGER NOT NULL,
    subject_type TEXT NOT NULL,
    subject_id INTEGER NOT NULL,
    summary TEXT NOT NULL,
    payload TEXT,
    status TEXT NOT NULL DEFAULT 'PENDENTE', -- PENDENTE, APROVADO, REJEITADO
    decided_by TEXT,
    note TEXT,
    created_at TEXT NOT NULL,
    decided_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_approvals_pending
    ON approvals(action, subject_type, subject_id) WHERE status = 'PENDENTE';

CREATE TABLE IF NOT EXISTS proposals (
    id INTEGER PRIMARY KEY,
    lead_id INTEGER NOT NULL REFERENCES leads(id),
    service_code TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL,     -- PRECO_PENDENTE, RASCUNHO, AGUARDANDO_APROVACAO, PRONTA, ENVIADA, ACEITA, RECUSADA, EXPIRADA
    list_price REAL,
    discount_pct REAL NOT NULL DEFAULT 0,
    final_price REAL,
    unit TEXT,
    valid_until TEXT,
    file_path TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    sent_at TEXT,
    UNIQUE (lead_id, service_code, version)
);

CREATE TABLE IF NOT EXISTS meetings (
    id INTEGER PRIMARY KEY,
    lead_id INTEGER NOT NULL REFERENCES leads(id),
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    location TEXT,
    status TEXT NOT NULL DEFAULT 'PROPOSTA', -- PROPOSTA, CONFIRMADA, REALIZADA, CANCELADA
    ics_path TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contracts (
    id INTEGER PRIMARY KEY,
    lead_id INTEGER NOT NULL REFERENCES leads(id),
    proposal_id INTEGER REFERENCES proposals(id),
    total_value REAL NOT NULL DEFAULT 0,
    monthly_value REAL NOT NULL DEFAULT 0,
    recurring INTEGER NOT NULL DEFAULT 0,
    signed_at TEXT NOT NULL,
    signed_by_owner_confirmed INTEGER NOT NULL DEFAULT 0,
    start_date TEXT,
    end_date TEXT,
    status TEXT NOT NULL DEFAULT 'ATIVO', -- ATIVO, ENCERRADO, CANCELADO
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS financial_entries (
    id INTEGER PRIMARY KEY,
    contract_id INTEGER REFERENCES contracts(id),
    kind TEXT NOT NULL CHECK (kind IN ('RECEITA', 'DESPESA')),
    category TEXT NOT NULL,
    description TEXT,
    amount REAL NOT NULL,
    status TEXT NOT NULL,       -- PREVISTO, REALIZADO
    due_date TEXT,
    paid_at TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS integration_usage (
    id INTEGER PRIMARY KEY,
    integration TEXT NOT NULL,
    day TEXT NOT NULL,
    calls INTEGER NOT NULL DEFAULT 0,
    est_cost REAL NOT NULL DEFAULT 0,
    UNIQUE (integration, day)
);

CREATE TABLE IF NOT EXISTS pending_integrations (
    name TEXT PRIMARY KEY,
    reason TEXT NOT NULL,
    action_needed TEXT,
    first_seen TEXT NOT NULL,
    last_seen TEXT NOT NULL,
    occurrences INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS dsr_requests (
    id INTEGER PRIMARY KEY,
    subject_ref TEXT NOT NULL,
    kind TEXT NOT NULL,            -- acesso, correcao, oposicao, eliminacao
    status TEXT NOT NULL,          -- RECEBIDA, ATENDIDA
    notes TEXT,
    received_at TEXT NOT NULL,
    completed_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_events (
    id INTEGER PRIMARY KEY,
    at TEXT NOT NULL,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    entity TEXT,
    entity_id TEXT,
    details TEXT
);

CREATE TABLE IF NOT EXISTS job_runs (
    id INTEGER PRIMARY KEY,
    job_name TEXT NOT NULL,
    scheduled_for TEXT NOT NULL,
    status TEXT NOT NULL,          -- EXECUTANDO, OK, FALHOU, PERDIDO
    started_at TEXT,
    finished_at TEXT,
    detail TEXT,
    UNIQUE (job_name, scheduled_for)
);

CREATE TABLE IF NOT EXISTS scheduler_lock (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    owner TEXT NOT NULL,
    heartbeat_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_messages_lead ON messages(lead_id, direction, created_at);
CREATE INDEX IF NOT EXISTS ix_tasks_due ON tasks(status, due_at);
CREATE INDEX IF NOT EXISTS ix_evidence_company ON evidence(company_id);
"""


class Database:
    def __init__(self, path: Path | str) -> None:
        self.path = Path(path)
        if str(path) != ":memory:":
            self.path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(str(path), timeout=30, isolation_level=None)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA foreign_keys = ON")
        if str(path) != ":memory:":
            self.conn.execute("PRAGMA journal_mode = WAL")
        self.conn.execute("PRAGMA busy_timeout = 30000")
        self._depth = 0

    # ------------------------------------------------------------------ esquema
    def init_schema(self) -> None:
        self.conn.executescript(SCHEMA)
        current = self.get_meta("schema_version")
        if current is None:
            self.set_meta("schema_version", str(SCHEMA_VERSION))

    # ------------------------------------------------------------------ transações
    @contextmanager
    def transaction(self) -> Iterator[sqlite3.Connection]:
        """Transação aninhável (savepoints). BEGIN IMMEDIATE evita corrida entre processos."""
        if self._depth == 0:
            self.conn.execute("BEGIN IMMEDIATE")
        else:
            self.conn.execute(f"SAVEPOINT sp{self._depth}")
        self._depth += 1
        try:
            yield self.conn
        except BaseException:
            self._depth -= 1
            if self._depth == 0:
                self.conn.execute("ROLLBACK")
            else:
                self.conn.execute(f"ROLLBACK TO sp{self._depth}")
                self.conn.execute(f"RELEASE sp{self._depth}")
            raise
        else:
            self._depth -= 1
            if self._depth == 0:
                self.conn.execute("COMMIT")
            else:
                self.conn.execute(f"RELEASE sp{self._depth}")

    # ------------------------------------------------------------------ helpers
    def execute(self, sql: str, params: tuple | dict = ()) -> sqlite3.Cursor:
        return self.conn.execute(sql, params)

    def one(self, sql: str, params: tuple | dict = ()) -> sqlite3.Row | None:
        return self.conn.execute(sql, params).fetchone()

    def all(self, sql: str, params: tuple | dict = ()) -> list[sqlite3.Row]:
        return self.conn.execute(sql, params).fetchall()

    def scalar(self, sql: str, params: tuple | dict = ()) -> Any:
        row = self.conn.execute(sql, params).fetchone()
        return None if row is None else row[0]

    def insert(self, table: str, values: dict) -> int:
        cols = ", ".join(values)
        marks = ", ".join("?" for _ in values)
        cur = self.conn.execute(f"INSERT INTO {table} ({cols}) VALUES ({marks})", tuple(values.values()))
        return int(cur.lastrowid)

    def get_meta(self, key: str) -> str | None:
        return self.scalar("SELECT value FROM meta WHERE key = ?", (key,))

    def set_meta(self, key: str, value: str | None) -> None:
        self.execute("INSERT INTO meta(key, value) VALUES(?, ?) "
                     "ON CONFLICT(key) DO UPDATE SET value = excluded.value", (key, value))

    def audit(self, action: str, entity: str | None = None, entity_id: Any = None,
              details: dict | None = None, actor: str = "agente") -> None:
        self.insert("audit_events", {
            "at": iso(), "actor": actor, "action": action, "entity": entity,
            "entity_id": None if entity_id is None else str(entity_id),
            "details": json.dumps(details or {}, ensure_ascii=False, default=str),
        })

    # ------------------------------------------------------------------ backup
    def backup(self, backup_dir: Path, keep: int = 14) -> Path:
        backup_dir.mkdir(parents=True, exist_ok=True)
        target = backup_dir / f"{self.path.stem}-{now().strftime('%Y%m%d-%H%M%S')}.db"
        dest = sqlite3.connect(str(target))
        try:
            self.conn.backup(dest)
        finally:
            dest.close()
        backups = sorted(backup_dir.glob(f"{self.path.stem}-*.db"))
        for old in backups[:-keep] if keep > 0 else []:
            old.unlink(missing_ok=True)
        return target

    def close(self) -> None:
        self.conn.close()


def open_db(path: Path | str) -> Database:
    db = Database(path)
    db.init_schema()
    return db
