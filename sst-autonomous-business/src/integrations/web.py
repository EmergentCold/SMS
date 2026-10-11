"""Leitor educado de páginas públicas: respeita robots.txt, identifica-se, limita a taxa.

Não contorna CAPTCHA, login ou bloqueios: qualquer 401/403/429 encerra a leitura do domínio.
"""
from __future__ import annotations

import time
import urllib.error
import urllib.request
import urllib.robotparser
from dataclasses import dataclass
from urllib.parse import urljoin, urlparse

from ..settings import env


class AccessDenied(RuntimeError):
    pass


@dataclass
class Page:
    url: str
    status: int
    text: str


class PoliteFetcher:
    name = "web_fetch"

    def __init__(self, user_agent: str, delay: float = 2.0, timeout: float = 15.0) -> None:
        contact = env("RESEARCH_CONTACT_EMAIL")
        self.user_agent = user_agent + (f" contato:{contact}" if contact else "")
        self.delay = delay
        self.timeout = timeout
        self._robots: dict[str, urllib.robotparser.RobotFileParser | None] = {}
        self._last: dict[str, float] = {}
        self._denied: set[str] = set()

    def _robots_for(self, url: str) -> urllib.robotparser.RobotFileParser | None:
        parsed = urlparse(url)
        root = f"{parsed.scheme}://{parsed.netloc}"
        if root not in self._robots:
            parser = urllib.robotparser.RobotFileParser()
            try:
                req = urllib.request.Request(urljoin(root, "/robots.txt"), headers={"User-Agent": self.user_agent})
                with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                    parser.parse(resp.read().decode("utf-8", errors="replace").splitlines())
            except urllib.error.HTTPError as exc:
                if exc.code in (401, 403):
                    parser.disallow_all = True  # type: ignore[attr-defined]
                else:
                    parser.allow_all = True  # type: ignore[attr-defined]
            except Exception:  # noqa: BLE001 - sem robots acessível: não arriscar
                parser = None
            self._robots[root] = parser
        return self._robots[root]

    def allowed(self, url: str) -> bool:
        parser = self._robots_for(url)
        return bool(parser and parser.can_fetch(self.user_agent, url))

    def get(self, url: str, max_bytes: int = 1_500_000) -> Page:
        host = urlparse(url).netloc
        if host in self._denied:
            raise AccessDenied(f"{host} negou acesso anteriormente")
        if not self.allowed(url):
            raise AccessDenied(f"robots.txt não permite {url} (ou robots indisponível)")
        wait = self.delay - (time.monotonic() - self._last.get(host, 0))
        if wait > 0:
            time.sleep(wait)
        req = urllib.request.Request(url, headers={"User-Agent": self.user_agent, "Accept": "text/html"})
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                raw = resp.read(max_bytes)
                charset = resp.headers.get_content_charset() or "utf-8"
                return Page(url=resp.geturl(), status=resp.status, text=raw.decode(charset, errors="replace"))
        except urllib.error.HTTPError as exc:
            if exc.code in (401, 403, 429):
                self._denied.add(host)
                raise AccessDenied(f"{host} respondeu {exc.code}; não insistir") from exc
            raise
        finally:
            self._last[host] = time.monotonic()
