"""Adaptadores de dados externos: busca web, CNPJ (dados públicos da Receita), B2B, CRM externo, IA.

Todos são opcionais e substituíveis. Sem configuração levantam NotConfigured — nunca simulam sucesso.
"""
from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass

from ..settings import env, env_bool
from .base import IntegrationStatus, NotConfigured


def _get_json(url: str, headers: dict, timeout: float = 20) -> dict:
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


# --------------------------------------------------------------------------- busca web
@dataclass
class SearchHit:
    title: str
    url: str
    snippet: str


class BraveSearch:
    """Brave Search API (https://api.search.brave.com). Variável: BRAVE_SEARCH_API_KEY."""

    name = "busca_web_brave"
    endpoint = "https://api.search.brave.com/res/v1/web/search"

    def __init__(self) -> None:
        self.key = env("BRAVE_SEARCH_API_KEY")
        self.cost_per_call = float(env("BRAVE_SEARCH_COST_BRL", "0") or 0)

    def is_configured(self) -> bool:
        return bool(self.key)

    def search(self, query: str, count: int = 10) -> list[SearchHit]:
        if not self.key:
            raise NotConfigured("BRAVE_SEARCH_API_KEY ausente")
        params = urllib.parse.urlencode({"q": query, "count": count, "country": "BR", "search_lang": "pt-br"})
        data = _get_json(f"{self.endpoint}?{params}", {"Accept": "application/json",
                                                         "X-Subscription-Token": self.key})
        results = data.get("web", {}).get("results", [])
        return [SearchHit(r.get("title", ""), r.get("url", ""), r.get("description", "")) for r in results]

    def verify(self) -> IntegrationStatus:
        if not self.key:
            return IntegrationStatus(self.name, False, None, "chave ausente",
                                     "criar conta na Brave Search API e definir BRAVE_SEARCH_API_KEY")
        try:
            self.search("segurança do trabalho", count=1)
            return IntegrationStatus(self.name, True, True, "consulta de teste ok")
        except Exception as exc:  # noqa: BLE001
            return IntegrationStatus(self.name, True, False, f"falha: {type(exc).__name__}", "conferir chave/rede")


# --------------------------------------------------------------------------- CNPJ
class BrasilApiCnpj:
    """Dados cadastrais públicos (Receita Federal) via BrasilAPI. Ativar com CNPJ_LOOKUP_ENABLED=true."""

    name = "cnpj_brasilapi"
    endpoint = "https://brasilapi.com.br/api/cnpj/v1/{cnpj}"

    def is_configured(self) -> bool:
        return env_bool("CNPJ_LOOKUP_ENABLED", False)

    def lookup(self, cnpj: str) -> dict:
        if not self.is_configured():
            raise NotConfigured("CNPJ_LOOKUP_ENABLED=false")
        return _get_json(self.endpoint.format(cnpj=cnpj), {"Accept": "application/json",
                                                           "User-Agent": "SST-Business-Research/0.1"})

    @staticmethod
    def size_from(data: dict) -> str:
        porte = (data.get("porte") or data.get("descricao_porte") or "").upper()
        if "MICRO" in porte:
            return "micro"
        if "PEQUENO" in porte:
            return "pequena"
        if porte:
            return "media_ou_grande"
        return "desconhecido"

    def verify(self) -> IntegrationStatus:
        if not self.is_configured():
            return IntegrationStatus(self.name, False, None, "desativado",
                                     "definir CNPJ_LOOKUP_ENABLED=true (API pública, sem chave)")
        try:
            self.lookup("00000000000191")
            return IntegrationStatus(self.name, True, True, "consulta de teste ok")
        except Exception as exc:  # noqa: BLE001
            return IntegrationStatus(self.name, True, False, f"falha: {type(exc).__name__}", "conferir rede")


# --------------------------------------------------------------------------- B2B / CRM externo
class B2BProvider:
    """Interface para provedor B2B licenciado (ex.: base contratada com termos que permitam prospecção)."""

    name = "provedor_b2b"

    def is_configured(self) -> bool:
        return bool(env("B2B_PROVIDER") and env("B2B_API_KEY"))

    def verify(self) -> IntegrationStatus:
        if not self.is_configured():
            return IntegrationStatus(self.name, False, None, "nenhum provedor contratado",
                                     "contratar provedor com licença de uso para prospecção e implementar adaptador")
        return IntegrationStatus(self.name, True, None, f"provedor {env('B2B_PROVIDER')} declarado; "
                                 "adaptador específico ainda não implementado")


class ExternalCrm:
    """O CRM principal é o SQLite local. Esta interface exporta para um CRM externo quando houver."""

    name = "crm_externo"

    def is_configured(self) -> bool:
        return bool(env("EXTERNAL_CRM") and env("EXTERNAL_CRM_TOKEN"))

    def verify(self) -> IntegrationStatus:
        if not self.is_configured():
            return IntegrationStatus(self.name, False, None, "não usado (CRM local SQLite ativo)",
                                     "opcional: definir EXTERNAL_CRM e EXTERNAL_CRM_TOKEN")
        return IntegrationStatus(self.name, True, None, "declarado; sincronização ainda não implementada")


# --------------------------------------------------------------------------- IA
class AnthropicModel:
    """Modelo de IA para redigir respostas. Variáveis: ANTHROPIC_API_KEY, AI_MODEL.

    A saída da IA é sempre rascunho: passa pelo filtro de conteúdo e pelos níveis de autonomia.
    """

    name = "modelo_ia"
    endpoint = "https://api.anthropic.com/v1/messages"

    def __init__(self) -> None:
        self.key = env("ANTHROPIC_API_KEY")
        self.model = env("AI_MODEL")
        self.cost_per_call = float(env("AI_COST_PER_CALL_BRL", "0") or 0)

    def is_configured(self) -> bool:
        return bool(self.key and self.model)

    def complete(self, system: str, prompt: str, max_tokens: int = 600) -> str:
        if not self.is_configured():
            raise NotConfigured("ANTHROPIC_API_KEY e/ou AI_MODEL ausentes")
        body = json.dumps({"model": self.model, "max_tokens": max_tokens, "system": system,
                           "messages": [{"role": "user", "content": prompt}]}).encode("utf-8")
        req = urllib.request.Request(self.endpoint, data=body, method="POST", headers={
            "x-api-key": self.key, "anthropic-version": "2023-06-01", "content-type": "application/json"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        return "".join(block.get("text", "") for block in data.get("content", []) if block.get("type") == "text")

    def verify(self) -> IntegrationStatus:
        if not self.is_configured():
            return IntegrationStatus(self.name, False, None, "não configurado (classificação por regras ativa)",
                                     "opcional: definir ANTHROPIC_API_KEY e AI_MODEL")
        try:
            self.complete("Responda apenas OK.", "teste", max_tokens=5)
            return IntegrationStatus(self.name, True, True, "chamada de teste ok")
        except Exception as exc:  # noqa: BLE001
            return IntegrationStatus(self.name, True, False, f"falha: {type(exc).__name__}", "conferir chave/modelo")
