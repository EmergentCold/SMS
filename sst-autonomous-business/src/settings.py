"""Configuração, relógio e logging com mascaramento de segredos.

Sem dependências externas: lê `.env` (se existir), variáveis de ambiente e os
JSON de `config/`. Credenciais só vêm do ambiente; nunca dos JSON versionados.
"""
from __future__ import annotations

import json
import logging
import logging.handlers
import os
import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

BASE_DIR = Path(__file__).resolve().parent.parent
TZ_NAME = "America/Sao_Paulo"
TZ = ZoneInfo(TZ_NAME)

SECRET_NAME_RE = re.compile(r"(PASSWORD|PASS|SECRET|TOKEN|API_KEY|_KEY$|CREDENTIAL)", re.I)


# --------------------------------------------------------------------------- relógio
class Clock:
    """Relógio substituível (testes congelam o tempo com `clock.set`)."""

    def __init__(self) -> None:
        self._fixed: datetime | None = None

    def now(self) -> datetime:
        if self._fixed is not None:
            return self._fixed
        return datetime.now(TZ)

    def set(self, value: datetime | None) -> None:
        if value is not None and value.tzinfo is None:
            value = value.replace(tzinfo=TZ)
        self._fixed = value


clock = Clock()


def now() -> datetime:
    return clock.now()


def iso(dt: datetime | None = None) -> str:
    """Datas sempre em ISO 8601 com offset de America/Sao_Paulo."""
    dt = dt or now()
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=TZ)
    return dt.astimezone(TZ).isoformat(timespec="seconds")


def parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=TZ)
    return dt.astimezone(TZ)


# --------------------------------------------------------------------------- .env
def load_dotenv(path: Path) -> None:
    """Carrega KEY=VALUE sem sobrescrever o ambiente já definido."""
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def env(name: str, default: str | None = None) -> str | None:
    value = os.environ.get(name)
    return value if value not in (None, "") else default


def env_bool(name: str, default: bool = False) -> bool:
    value = env(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "sim", "on"}


# --------------------------------------------------------------------------- config
@dataclass
class Settings:
    base_dir: Path
    config_dir: Path
    data_dir: Path
    reports_dir: Path
    templates_dir: Path
    db_path: Path
    business: dict
    services: dict
    pricing: dict
    outreach: dict
    autonomy: dict
    research: dict
    schedule: dict
    simulation: bool = False
    extra: dict = field(default_factory=dict)

    @property
    def external_sending_enabled(self) -> bool:
        return env_bool("EXTERNAL_SENDING_ENABLED", False) and not self.simulation

    @property
    def kill_switch_file(self) -> Path:
        return self.data_dir / "STOP_SENDING"

    @property
    def logs_dir(self) -> Path:
        return self.data_dir / "logs"

    def owner_identity_configured(self) -> bool:
        owner = self.business.get("owner", {})
        brand = self.business.get("brand", {})
        return owner.get("name") not in (None, "", "CONFIGURAR") and brand.get("commercial_email") not in (None, "")


def _read_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def load_settings(base_dir: Path | None = None, *, db_path: Path | None = None,
                  data_dir: Path | None = None, simulation: bool = False) -> Settings:
    base = Path(base_dir or BASE_DIR)
    load_dotenv(base / ".env")
    cfg = base / "config"
    # A simulação usa diretório próprio: não mistura propostas/convites nem aciona o kill switch real.
    data = Path(data_dir or (base / "data" / "simulation" if simulation else env("SST_DATA_DIR") or base / "data"))
    data.mkdir(parents=True, exist_ok=True)
    reports = Path(env("SST_REPORTS_DIR") or base / "reports") / ("simulation" if simulation else "")
    reports.mkdir(parents=True, exist_ok=True)
    default_db = data / ("simulation.db" if simulation else "sst.db")
    return Settings(
        base_dir=base,
        config_dir=cfg,
        data_dir=data,
        reports_dir=reports,
        templates_dir=base / "templates",
        db_path=Path(db_path or (default_db if simulation else (env("SST_DB_PATH") or default_db))),
        business=_read_json(cfg / "business.json"),
        services=_read_json(cfg / "services.json"),
        pricing=_read_json(cfg / "pricing.json"),
        outreach=_read_json(cfg / "outreach.json"),
        autonomy=_read_json(cfg / "autonomy.json"),
        research=_read_json(cfg / "research.json"),
        schedule=_read_json(cfg / "schedule.json"),
        simulation=simulation,
    )


# --------------------------------------------------------------------------- logging
_INLINE_SECRET_RE = re.compile(
    r"(?i)\b(password|passwd|senha|token|api[_-]?key|secret|authorization)\b(\s*[:=]\s*|\s+)(bearer\s+)?([^\s,;'\"]+)"
)
_BEARER_RE = re.compile(r"(?i)bearer\s+[A-Za-z0-9._\-]+")
_KEYLIKE_RE = re.compile(r"\b(sk-[A-Za-z0-9_\-]{8,}|xox[abp]-[A-Za-z0-9\-]{8,}|gh[pousr]_[A-Za-z0-9]{16,})\b")


def secret_values() -> list[str]:
    values = []
    for key, value in os.environ.items():
        if value and len(value) >= 4 and SECRET_NAME_RE.search(key):
            values.append(value)
    return sorted(values, key=len, reverse=True)


def redact(text: str) -> str:
    for value in secret_values():
        text = text.replace(value, "***")
    text = _INLINE_SECRET_RE.sub(lambda m: f"{m.group(1)}{m.group(2)}***", text)
    text = _BEARER_RE.sub("Bearer ***", text)
    text = _KEYLIKE_RE.sub("***", text)
    return text


class RedactingFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        try:
            message = record.getMessage()
        except Exception:  # pragma: no cover - mensagem malformada
            message = str(record.msg)
        record.msg = redact(message)
        record.args = ()
        return True


def setup_logging(settings: Settings, level: str | None = None) -> logging.Logger:
    logger = logging.getLogger("sst")
    if getattr(logger, "_sst_configured", False):
        return logger
    logger.setLevel(level or env("LOG_LEVEL", "INFO"))
    settings.logs_dir.mkdir(parents=True, exist_ok=True)
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s")
    redactor = RedactingFilter()

    console = logging.StreamHandler()
    console.setFormatter(fmt)
    console.addFilter(redactor)
    logger.addHandler(console)

    app = logging.handlers.RotatingFileHandler(settings.logs_dir / "app.log", maxBytes=2_000_000,
                                               backupCount=5, encoding="utf-8")
    app.setFormatter(fmt)
    app.addFilter(redactor)
    logger.addHandler(app)

    alerts = logging.handlers.RotatingFileHandler(settings.logs_dir / "alerts.log", maxBytes=1_000_000,
                                                  backupCount=5, encoding="utf-8")
    alerts.setLevel(logging.ERROR)
    alerts.setFormatter(fmt)
    alerts.addFilter(redactor)
    logger.addHandler(alerts)

    logger._sst_configured = True  # type: ignore[attr-defined]
    return logger


def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(f"sst.{name}")
    if not any(isinstance(f, RedactingFilter) for f in logger.filters):
        logger.addFilter(RedactingFilter())
    return logger
