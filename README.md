# Emergent Cold — SST

## Crachás SST (Emissor e ficha do crachá)

Página pública que o celular abre ao escanear o QR Code dos crachás emitidos pelo **Emissor de Crachás SMS**.

- `emissor.html` — Emissor de Crachás SMS (`https://emergentcold.github.io/SMS/emissor.html`). A planilha escolhida é lida só no navegador de quem usa; nada é enviado a servidor.
- `ficha.html` — mostra a ficha do colaborador (ASO / NRs, status e validades) em formato de formulário.
- **Não há dados de colaboradores neste repositório.** As informações vão dentro do próprio QR, no trecho do link após o `#`, que o navegador não envia ao servidor.
- Publicado pelo GitHub Pages: `https://emergentcold.github.io/SMS/ficha.html`

- Site: https://emergentcold.github.io/SMS/ (GitHub Pages, branch main, raiz).
- Publicação automática: a cada envio para a branch main.

---

## Galpão Seguro — jogos de segurança do armazém (projeto separado dos crachás)

Projeto independente dos crachás: não aparece na página inicial do site (que é só dos crachás) e é acessado pelo link direto ou pelo QR Code da pasta `qr/`. Não usa nem lê dados dos crachás.

- `jogos.html` — **Galpão Seguro** (`https://emergentcold.github.io/SMS/jogos.html`), link único dos jogos de segurança do trabalho para o armazém: 8 fases (caminho seguro, empilhadeiras, transpaleteiras/paleteiras, porta-paletes, picking, logística reversa, docas e desafio final) com caça a condições e comportamentos inseguros, "seguro ou inseguro", quiz e labirinto. A tela inicial tem duas áreas separadas:
  - **Área do jogador** — o funcionário só se cadastra (ou entra pela matrícula) e joga; não consegue alterar nada. Ao concluir as 8 fases, recebe o certificado em PDF.
  - **Área do administrador** — só com PIN (criado no primeiro acesso em cada aparelho): Painel SST, ranking, exportação CSV, backup/importação, exclusão e certificados. Bloqueia ao tocar em "Bloquear", ao voltar ao início, ao recarregar a página ou após 5 minutos sem uso.
  - Os dados ficam no navegador do aparelho onde se joga; para juntar vários aparelhos, use o backup do painel.
- `jogos-admin.html` — endereço antigo do administrador; redireciona para `jogos.html` já pedindo o PIN.
- `galpao.js` e `galpao.css` — código e visual do jogo.

Criado por **Luan Tavarez — Técnico em Segurança do Trabalho**.

- `qr/` — QR Code do link do jogo e cartaz A4 (PDF/PNG) para divulgação.

---

## Projeto separado: Hospital Seguro

O **Hospital Seguro** é um projeto independente do Galpão Seguro e da Emergent Cold. Ele fica hospedado neste mesmo repositório só por praticidade, mas **não aparece na página inicial da Emergent Cold** e é acessado apenas pelo link direto. Não compartilha dados com o Galpão Seguro: cada jogo tem suas próprias inscrições, pontuações, ranking e certificados.

- `hospital.html` — **Hospital Seguro** (criado por **Luan Tavarez**, Técnico em Segurança do Trabalho), jogos de segurança do trabalho em serviços de saúde (`https://emergentcold.github.io/SMS/hospital.html`): a rotina de um plantão em 6 fases (UTI/Internação, Centro Cirúrgico, Farmácia, Almoxarifado, Administrativo e Ronda Final). Caça aos riscos com condições e comportamentos inseguros que **mudam a cada partida** (cada ponto da cena aparece no jeito errado ou no jeito certo), "Descarte Certo" (caixa de perfurocortante, caixa laranja, infectante, comum, papel, plástico e dados sensíveis), "Passo a Passo" (acidente com agulha, limpeza da sala cirúrgica, medicamento quebrado, kit de derramamento nível I), "seguro ou inseguro", quiz e dois jogos de habilidade dentro das fases, com o conteúdo de cada setor (UTI, Farmácia e Administrativo: Descarte em Movimento; Centro Cirúrgico e Almoxarifado: Risco Ninja; Ronda Final: os dois com tudo misturado): **Risco Ninja** (deslizar o dedo para cortar os riscos que voam pela tela sem cortar as proteções) e **Descarte em Movimento** (arrastar cada resíduo que cai para a lixeira certa: perfurocortante, caixa laranja, infectante, comum, papel, plástico e dados sensíveis). O colaborador só se cadastra (ou entra pela matrícula) e joga, e tem o **Meu painel** (pontos, nível, estrelas, recorde por fase, posição no ranking geral e do setor, próximos passos e certificado). A gestão fica na página do administrador (`hospital-admin.html`), **protegida por PIN**: indicadores, desempenho por fase (com a fase de menor desempenho), participação por setor, ranking, lista de colaboradores, exportar CSV, backup/importação, certificados, nome da instituição, trocar PIN e apagar dados. Ao concluir as 6 fases, abre na hora o certificado com o nome da inscrição (baixar em PDF no celular, tablet ou notebook, compartilhar ou imprimir; PDF gerado no próprio aparelho, sem internet), com data de conclusão e código de verificação também exportados no CSV. Mesma inscrição, ranking e Painel SST do Galpão Seguro (cores e logo do Hospital Beneficência Portuguesa no cabeçalho, nas cenas e no certificado); dados só no navegador do aparelho.
- `hospital-admin.html` — **Hospital Seguro · Administração** (`https://emergentcold.github.io/SMS/hospital-admin.html`): abre bloqueada e só entra com o PIN do SST; painel do administrador (indicadores, desempenho por fase e por setor), ranking, lista de colaboradores, CSV, backup/importação, certificados, trocar PIN e apagar dados. A página `hospital.html` é só do colaborador (cadastro, jogo e Meu painel) e não tem nenhuma ação de administração.
- `hospital.js` e `hospital.css` — código e visual compartilhados pelas duas páginas.
