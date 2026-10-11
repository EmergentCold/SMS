"""Contexto da aplicação: configurações + banco + logger + integrações."""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path

from .database import Database, open_db
from .settings import Settings, load_settings, setup_logging


@dataclass
class App:
    settings: Settings
    db: Database
    log: logging.Logger
    overrides: dict = field(default_factory=dict)  # testes/simulação injetam adaptadores aqui

    def close(self) -> None:
        self.db.close()


def build_app(base_dir: Path | None = None, *, db_path: Path | None = None, data_dir: Path | None = None,
              simulation: bool = False) -> App:
    settings = load_settings(base_dir, db_path=db_path, data_dir=data_dir, simulation=simulation)
    log = setup_logging(settings)
    db = open_db(settings.db_path)
    return App(settings=settings, db=db, log=log)
