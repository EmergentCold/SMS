# Emergent Cold — Ficha do crachá (SST)

Página pública que o celular abre ao escanear o QR Code dos crachás emitidos pelo **Emissor de Crachás SMS**.

- `emissor.html` — Emissor de Crachás SMS (`https://emergentcold.github.io/SMS/emissor.html`). A planilha escolhida é lida só no navegador de quem usa; nada é enviado a servidor.
- `ficha.html` — mostra a ficha do colaborador (ASO / NRs, status e validades) em formato de formulário.
- **Não há dados de colaboradores neste repositório.** As informações vão dentro do próprio QR, no trecho do link após o `#`, que o navegador não envia ao servidor.
- Publicado pelo GitHub Pages: `https://emergentcold.github.io/SMS/ficha.html`

- Site: https://emergentcold.github.io/SMS/ (GitHub Pages, branch main, raiz).
- Publicação automática: a cada envio para a branch main.

## SST Autonomous Business Agent

A pasta [`sst-autonomous-business/`](sst-autonomous-business/) contém o sistema comercial automatizado de
consultoria em SST (pesquisa, qualificação, prospecção, follow-up, propostas, CRM e relatórios).
Veja [`sst-autonomous-business/README.md`](sst-autonomous-business/README.md) e
[`sst-autonomous-business/STATUS.md`](sst-autonomous-business/STATUS.md).
Dados operacionais (`data/`, `reports/`, `.env`) não são versionados.

## Pasta "Segurança do Trabalho em Projetos"

Para adicionar a pasta da Área de Trabalho ao repositório, no computador onde ela está:

```bash
git clone https://github.com/emergentcold/sms.git && cd sms
git checkout claude/sst-autonomous-agent-scmmqs
cp -r ~/Desktop/"Segurança do Trabalho em Projetos" ./seguranca-do-trabalho-em-projetos   # Windows: Área de Trabalho
git add seguranca-do-trabalho-em-projetos && git commit -m "Adiciona pasta Segurança do Trabalho em Projetos" && git push
```

Antes de enviar, confira se não há dados pessoais de colaboradores (ASO, CPF, fichas): este repositório é
publicado no GitHub Pages.
