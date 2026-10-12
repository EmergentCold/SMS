# Ensaio automatizado do instalador e da ponte com o Power Platform

Usado para validar o instalador fora do Windows (cmdlets exclusivos do Windows são substituídos por funções que
registram a chamada; Git, Python, testes, pastas e arquivos são reais).

```bash
pwsh -NoProfile -File instalar/ensaio/ensaio_instalador.ps1 -Repositorio <url-ou-caminho-do-repo> -Raiz /tmp/ensaio
cd /tmp/ensaio/home/sst-agent
python3 -m src.main daemon &   # o que a tarefa agendada "SST Agent" faz
python3 -m src.main api &      # o que a tarefa "SST Agent API" faz
python3 <repo>/instalar/ensaio/operar_como_power_automate.py .
```

`operar_como_power_automate.py` age como os fluxos do Power Automate e o app do Power Apps: só grava comandos
JSON em `<OneDrive>/SST-Agent/inbox` e lê `outbox/`, `aprovacoes/` e `export/painel.json`.
