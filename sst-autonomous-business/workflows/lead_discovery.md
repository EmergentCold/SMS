# Workflow — Descoberta e enriquecimento de leads

**Módulos:** `src/research/discovery.py`, `enrichment.py`, `importer.py`, `dedupe.py`.
**Job:** `research` (dias úteis 07:30). **Nível:** 1 (automático).

## Caminho A — API de busca (requer `BRAVE_SEARCH_API_KEY`)
1. Gera consultas segmento × cidade (`config/research.json → queries`), no máximo `max_queries_per_run`.
2. Ignora domínios bloqueados (redes sociais, diretórios, gov.br, portais de vagas).
3. Cria/mescla empresa por domínio (deduplicação por CNPJ → domínio → e-mail → telefone).
4. Registra a busca como fonte (`data_sources`) e o segmento inferido como **HIPÓTESE**.
5. Enriquecimento no site oficial: lê `/`, `/contato`, `/fale-conosco` respeitando `robots.txt`;
   extrai e-mails genéricos **do próprio domínio** (contato@, comercial@...), CNPJ publicado (validado),
   sinais de demanda (FATO "site menciona X" + HIPÓTESE de necessidade).
6. Se `CNPJ_LOOKUP_ENABLED=true`, consulta porte/CNAE no cadastro público.

Sem chave: o job registra a pendência `busca_web_brave` e **não inventa resultados**.

## Caminho B — CSV do proprietário (funciona sem credenciais)
```bash
python -m src.main leads import examples/leads_template.csv
```
Cada linha exige `source_url` ou `source_description`. Linhas sem origem são rejeitadas.

## Saídas
Empresas, contatos (com base legal), evidências e leads em `PESQUISADO`.

## Nunca
Inventar contato, e-mail, porte, funcionários, acidentes ou problemas de conformidade; contornar bloqueios.
