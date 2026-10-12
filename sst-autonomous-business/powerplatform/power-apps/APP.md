# App do Power Apps — "SST Agent" (tela de celular)

App de tela (*canvas*) em formato **Telefone**. Fonte de dados no Modo A: os fluxos **SST – Ler painel** e
**SST – Enviar comando** (ver `../power-automate/FLUXOS.md`). No Modo B, troque pelas ações do conector
(seção final).

Montagem: make.powerapps.com → **Criar → Aplicativo de tela em branco → Telefone**. Em
**Power Automate** (painel lateral) → **Adicionar fluxo** → selecione os dois fluxos.

## 1. App

**App.OnStart**
```powerfx
Set(varCarregando, true);
Set(varPainel, ParseJSON('SST–Lerpainel'.Run().painel));
ClearCollect(colAprovacoes,
    ForAll(Table(varPainel.aprovacoes),
        { id: Value(ThisRecord.Value.id),
          resumo: Text(ThisRecord.Value.summary),
          acao: Text(ThisRecord.Value.action),
          nivel: Value(ThisRecord.Value.level),
          criado: DateTimeValue(Text(ThisRecord.Value.created_at)) }));
ClearCollect(colLeads,
    ForAll(Table(varPainel.leads),
        { id: Value(ThisRecord.Value.id),
          empresa: Text(ThisRecord.Value.empresa),
          segmento: Text(ThisRecord.Value.segmento),
          cidade: Text(ThisRecord.Value.cidade),
          pontuacao: Value(ThisRecord.Value.pontuacao),
          estado: Text(ThisRecord.Value.status_rotulo),
          proxima: Text(ThisRecord.Value.proxima_acao) }));
ClearCollect(colPipeline,
    ForAll(Table(varPainel.pipeline),
        { rotulo: Text(ThisRecord.Value.rotulo), qtd: Value(ThisRecord.Value.quantidade) }));
Set(varKill, Boolean(varPainel.kill_switch.ativo));
Set(varResumo, varPainel.resumo);
Set(varCarregando, false)
```
> O nome do fluxo no Power Fx é gerado pelo Power Apps a partir do nome do fluxo (ex.: `'SST–Lerpainel'`
> ou `SSTLerpainel`). Use o IntelliSense para confirmar o nome exato.

## 2. Tela `scrPainel`

| Controle | Propriedade | Fórmula |
|---|---|---|
| `lblTitulo` (Rótulo) | Text | `"SST Agent"` |
| `lblAtualizado` | Text | `"Atualizado em " & Text(DateTimeValue(Text(varPainel.gerado_em)), "dd/mm hh:mm")` |
| `lblPausa` | Text | `If(varKill, "ENVIOS PAUSADOS", "Envios ativos")` |
| `lblPausa` | Color | `If(varKill, Color.Red, Color.Green)` |
| `galKpis` (Galeria em branco, 2 colunas) | Items | ver abaixo |
| `galPipeline` (Galeria vertical) | Items | `colPipeline` |
| `btnAtualizar` | OnSelect | `Select(btnCarregar)` (ver dica abaixo) |
| `btnPausar` | Text | `If(varKill, "Retomar envios", "Pausar envios")` |
| `btnPausar` | OnSelect | ver abaixo |
| `btnAprovacoes` | Text | `"Aprovações (" & CountRows(colAprovacoes) & ")"` |
| `btnAprovacoes` | OnSelect | `Navigate(scrAprovacoes, ScreenTransition.Cover)` |
| `btnLeads` | OnSelect | `Navigate(scrLeads, ScreenTransition.Cover)` |

Dica para **Atualizar**: coloque o mesmo conteúdo de App.OnStart no `OnSelect` de um botão oculto
`btnCarregar` (Visible = `false`) nesta tela. `btnAtualizar.OnSelect` = `Select(btnCarregar)`.
O painel é regenerado pelo agente a cada hora e logo após cada comando processado.

**galKpis.Items**
```powerfx
Table(
  { rotulo: "Leads qualificados", valor: Text(Value(varResumo.leads_qualificados)) },
  { rotulo: "Mensagens enviadas", valor: Text(Value(varResumo.mensagens_enviadas)) },
  { rotulo: "Taxa de resposta",   valor: If(IsBlank(varResumo.taxa_resposta_pct), "—", Text(Value(varResumo.taxa_resposta_pct), "0,0") & "%") },
  { rotulo: "Reuniões",           valor: Text(Value(varResumo.reunioes)) },
  { rotulo: "Propostas",          valor: Text(Value(varResumo.propostas_enviadas)) },
  { rotulo: "Contratos",          valor: Text(Value(varResumo.contratos)) },
  { rotulo: "Receita contratada", valor: Text(Value(varResumo.receita_contratada), "R$ #.##0,00") },
  { rotulo: "Receita recebida",   valor: Text(Value(varResumo.receita_recebida), "R$ #.##0,00") }
)
```
Dentro da galeria: `ThisItem.valor` (rótulo grande) e `ThisItem.rotulo` (rótulo pequeno).
Receita potencial, propostas, contratada e recebida são **categorias separadas** — não some.

**btnPausar.OnSelect**
```powerfx
If(
    Confirm(If(varKill, "Retomar os envios externos?", "Pausar TODOS os envios externos agora?")),
    'SST–Enviarcomando'.Run(JSON({
        id: GUID(),
        type: "kill_switch",
        on: !varKill,
        reason: "Power Apps",
        by: User().Email
    }));
    Set(varKill, !varKill);
    Notify("Comando enviado. O agente aplica em até 2 minutos.", NotificationType.Success)
)
```
(`Confirm` existe nas versões recentes; se não estiver disponível, use uma tela de confirmação.)

## 3. Tela `scrAprovacoes`

| Controle | Propriedade | Fórmula |
|---|---|---|
| `galAprovacoes` (Galeria vertical) | Items | `SortByColumns(colAprovacoes, "id")` |
| `lblResumo` | Text | `ThisItem.resumo` |
| `lblMeta` | Text | `"#" & ThisItem.id & " · " & ThisItem.acao & " · nível " & ThisItem.nivel` |
| `lblMeta` | Color | `If(ThisItem.nivel = 3, Color.Red, Color.Gray)` |
| `btnAprovar` | OnSelect | ver abaixo |
| `btnRejeitar` | OnSelect | igual, com `approve: false` e `note: txtMotivo.Text` |
| `btnVoltar` | OnSelect | `Back()` |

**btnAprovar.OnSelect**
```powerfx
'SST–Enviarcomando'.Run(JSON({
    id: GUID(),
    type: "approval_decision",
    approval_id: ThisItem.id,
    approve: true,
    by: User().Email,
    note: ""
}));
Remove(colAprovacoes, ThisItem);
Notify("Aprovação enviada ao agente.", NotificationType.Success)
```

## 4. Tela `scrLeads`

| Controle | Propriedade | Fórmula |
|---|---|---|
| `ddEstado` (Lista suspensa) | Items | `Distinct(colLeads, estado)` |
| `ddEstado` | AllowEmptySelection | `true` |
| `txtBusca` | HintText | `"Buscar empresa"` |
| `galLeads` | Items | ver abaixo |
| `lblEmpresa` | Text | `ThisItem.empresa` |
| `lblDetalhe` | Text | `ThisItem.segmento & " · " & ThisItem.cidade & " · " & ThisItem.pontuacao & " pts"` |
| `lblEstado` | Text | `ThisItem.estado & " → " & ThisItem.proxima` |

**galLeads.Items**
```powerfx
SortByColumns(
    Filter(colLeads,
        (IsBlank(ddEstado.Selected.Value) || estado = ddEstado.Selected.Value) &&
        (IsBlank(txtBusca.Text) || txtBusca.Text in empresa)),
    "pontuacao", SortOrder.Descending)
```

## 5. Tela `scrResposta` (registrar resposta recebida por telefone/WhatsApp)

| Controle | Propriedade | Fórmula |
|---|---|---|
| `txtDe` | HintText | `"e-mail do contato"` |
| `txtTexto` | Mode | `TextMode.MultiLine` |
| `btnRegistrar` | OnSelect | ver abaixo |

```powerfx
'SST–Enviarcomando'.Run(JSON({
    id: GUID(), type: "inbound_message",
    from: Lower(Trim(txtDe.Text)), subject: "Registro manual (Power Apps)",
    body: txtTexto.Text, by: User().Email
}));
Reset(txtDe); Reset(txtTexto);
Notify("Resposta registrada. O agente atualiza o pipeline e cancela os follow-ups.", NotificationType.Success)
```

## 6. Modo B (conector Premium "SST Agent")

Adicione o conector como fonte de dados e substitua:

| Modo A | Modo B |
|---|---|
| `ParseJSON('SST–Lerpainel'.Run().painel)` | `SSTAgent.ObterPainel()` (já tipado: use `.aprovacoes`, `.leads`, `.resumo` sem `Text()/Value()`) |
| comando `approval_decision` | `SSTAgent.DecidirAprovacao(ThisItem.id, { approve: true, by: User().Email })` |
| comando `kill_switch` | `SSTAgent.KillSwitch({ on: !varKill, reason: "Power Apps", by: User().Email })` |
| comando `inbound_message` | `SSTAgent.RegistrarResposta({ from: txtDe.Text, body: txtTexto.Text })` |

## Boas práticas

- Compartilhe o app **somente** com quem pode decidir pelo negócio.
- O app nunca guarda o token da ponte nem da API (fica no fluxo/conexão).
- As decisões aparecem no CRM com o autor `ponte:<e-mail>` ou `api:<e-mail>`.
