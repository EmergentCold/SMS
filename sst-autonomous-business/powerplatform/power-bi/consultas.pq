// =====================================================================================
// SST Agent — consultas Power Query (M) para o Power BI Desktop
// Como usar: Página Inicial → Transformar dados → Nova fonte → Consulta nula → Editor avançado.
// Crie UMA consulta por bloco abaixo, com o nome indicado no comentário "Nome:".
// Fonte: CSVs gerados por `python -m src.main powerbi-export` em <POWERPLATFORM_DIR>/export/
// =====================================================================================


// -------------------------------------------------------------------------------------
// Nome: PastaDados   (parâmetro — Gerenciar parâmetros → Novo, tipo Texto)
// Opção 1 (pasta local/OneDrive sincronizado; atualização no serviço exige gateway):
//   C:\Users\voce\OneDrive - Empresa\SST-Agent\export\
// Opção 2 (sem gateway): use fnLerCsvSharePoint abaixo com a URL do site/OneDrive.
// -------------------------------------------------------------------------------------
"C:\Users\voce\OneDrive - Empresa\SST-Agent\export\" meta [IsParameterQuery = true, Type = "Text", IsParameterQueryRequired = true]


// -------------------------------------------------------------------------------------
// Nome: fnLerCsv   (função — lê um CSV da pasta local; células vazias viram null)
// -------------------------------------------------------------------------------------
(nome as text) as table =>
let
    Origem = Csv.Document(
        File.Contents(PastaDados & nome & ".csv"),
        [Delimiter = ",", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]),
    Cabecalhos = Table.PromoteHeaders(Origem, [PromoteAllScalars = true]),
    Nulos = Table.ReplaceValue(Cabecalhos, "", null, Replacer.ReplaceValue, Table.ColumnNames(Cabecalhos))
in
    Nulos


// -------------------------------------------------------------------------------------
// Nome: fnLerCsvSharePoint   (alternativa SEM gateway — OneDrive for Business/SharePoint)
// SiteUrl exemplo OneDrive: "https://empresa-my.sharepoint.com/personal/voce_empresa_com_br"
// SiteUrl exemplo SharePoint: "https://empresa.sharepoint.com/sites/SST"
// Para usar: troque "fnLerCsv" por "fnLerCsvSharePoint" nas consultas de tabela.
// -------------------------------------------------------------------------------------
(nome as text) as table =>
let
    SiteUrl = "https://empresa-my.sharepoint.com/personal/voce_empresa_com_br",
    Arquivos = SharePoint.Files(SiteUrl, [ApiVersion = 15]),
    Alvo = Table.SelectRows(Arquivos, each [Name] = nome & ".csv" and Text.Contains([Folder Path], "/SST-Agent/export/")),
    Conteudo = Alvo{0}[Content],
    Origem = Csv.Document(Conteudo, [Delimiter = ",", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]),
    Cabecalhos = Table.PromoteHeaders(Origem, [PromoteAllScalars = true]),
    Nulos = Table.ReplaceValue(Cabecalhos, "", null, Replacer.ReplaceValue, Table.ColumnNames(Cabecalhos))
in
    Nulos


// -------------------------------------------------------------------------------------
// Nome: dim_empresa
// -------------------------------------------------------------------------------------
let
    Fonte = fnLerCsv("dim_empresa"),
    Tipos = Table.TransformColumnTypes(Fonte, {
        {"empresa_id", Int64.Type}, {"nome", type text}, {"segmento", type text}, {"segmento_confianca", type text},
        {"cidade", type text}, {"uf", type text}, {"porte", type text}, {"porte_confianca", type text},
        {"dominio", type text}, {"simulacao", Int64.Type}, {"criado_em", type datetimezone}}, "en-US"),
    SemSimulacao = Table.SelectRows(Tipos, each [simulacao] = 0)
in
    SemSimulacao


// -------------------------------------------------------------------------------------
// Nome: fato_lead
// -------------------------------------------------------------------------------------
let
    Fonte = fnLerCsv("fato_lead"),
    Tipos = Table.TransformColumnTypes(Fonte, {
        {"lead_id", Int64.Type}, {"empresa_id", Int64.Type}, {"status", type text}, {"status_rotulo", type text},
        {"pontuacao", Int64.Type}, {"prioridade", type text}, {"servicos", type text}, {"proxima_acao", type text},
        {"primeiro_contato_em", type datetimezone}, {"ganho_em", type datetimezone}, {"motivo_perda", type text},
        {"criado_em", type datetimezone}, {"atualizado_em", type datetimezone}}, "en-US"),
    Data = Table.AddColumn(Tipos, "data_criacao", each Date.From(DateTimeZone.RemoveZone([criado_em])), type date),
    Ordem = Table.AddColumn(Data, "ordem_funil", each
        List.PositionOf({"PESQUISADO","QUALIFICADO","CONTATO_AUTORIZADO","AGUARDANDO_APROVACAO","CONTATADO",
                         "RESPONDEU","REUNIAO","PROPOSTA","NEGOCIACAO","GANHO","PERDIDO","DESCADASTRADO","BLOQUEADO"},
                        [status]) + 1, Int64.Type)
in
    Ordem


// -------------------------------------------------------------------------------------
// Nome: fato_pipeline_eventos
// -------------------------------------------------------------------------------------
let
    Fonte = fnLerCsv("fato_pipeline_eventos"),
    Tipos = Table.TransformColumnTypes(Fonte, {
        {"evento_id", Int64.Type}, {"lead_id", Int64.Type}, {"de", type text}, {"para", type text},
        {"evidencia", type text}, {"motivo", type text}, {"data", type datetimezone}}, "en-US"),
    Dia = Table.AddColumn(Tipos, "dia", each Date.From(DateTimeZone.RemoveZone([data])), type date)
in
    Dia


// -------------------------------------------------------------------------------------
// Nome: fato_mensagens   (sem assunto/corpo — minimização LGPD)
// -------------------------------------------------------------------------------------
let
    Fonte = fnLerCsv("fato_mensagens"),
    Tipos = Table.TransformColumnTypes(Fonte, {
        {"mensagem_id", Int64.Type}, {"lead_id", Int64.Type}, {"direcao", type text}, {"canal", type text},
        {"tipo", type text}, {"etapa", Int64.Type}, {"status", type text}, {"intencao", type text},
        {"tentativas", Int64.Type}, {"criado_em", type datetimezone}, {"enviado_em", type datetimezone}}, "en-US"),
    Dia = Table.AddColumn(Tipos, "dia", each Date.From(DateTimeZone.RemoveZone(
        if [enviado_em] <> null then [enviado_em] else [criado_em])), type date)
in
    Dia


// -------------------------------------------------------------------------------------
// Nome: fato_propostas
// -------------------------------------------------------------------------------------
let
    Fonte = fnLerCsv("fato_propostas"),
    Tipos = Table.TransformColumnTypes(Fonte, {
        {"proposta_id", Int64.Type}, {"lead_id", Int64.Type}, {"servico", type text}, {"versao", Int64.Type},
        {"status", type text}, {"preco_tabela", type number}, {"desconto_pct", type number},
        {"preco_final", type number}, {"unidade", type text}, {"validade", type date},
        {"criado_em", type datetimezone}, {"enviado_em", type datetimezone}}, "en-US"),
    Dia = Table.AddColumn(Tipos, "dia", each Date.From(DateTimeZone.RemoveZone(
        if [enviado_em] <> null then [enviado_em] else [criado_em])), type date)
in
    Dia


// -------------------------------------------------------------------------------------
// Nome: fato_contratos
// -------------------------------------------------------------------------------------
let
    Fonte = fnLerCsv("fato_contratos"),
    Tipos = Table.TransformColumnTypes(Fonte, {
        {"contrato_id", Int64.Type}, {"lead_id", Int64.Type}, {"proposta_id", Int64.Type},
        {"valor_total", type number}, {"valor_mensal", type number}, {"recorrente", Int64.Type},
        {"assinado_em", type date}, {"inicio", type date}, {"fim", type date}, {"status", type text}}, "en-US")
in
    Tipos


// -------------------------------------------------------------------------------------
// Nome: fato_financeiro
// -------------------------------------------------------------------------------------
let
    Fonte = fnLerCsv("fato_financeiro"),
    Tipos = Table.TransformColumnTypes(Fonte, {
        {"lancamento_id", Int64.Type}, {"contrato_id", Int64.Type}, {"tipo", type text}, {"categoria", type text},
        {"valor", type number}, {"status", type text}, {"vencimento", type date}, {"pago_em", type date}}, "en-US"),
    Dia = Table.AddColumn(Tipos, "dia", each if [pago_em] <> null then [pago_em] else [vencimento], type date)
in
    Dia


// -------------------------------------------------------------------------------------
// Nome: fato_reunioes
// -------------------------------------------------------------------------------------
let
    Fonte = fnLerCsv("fato_reunioes"),
    Tipos = Table.TransformColumnTypes(Fonte, {
        {"reuniao_id", Int64.Type}, {"lead_id", Int64.Type}, {"inicio", type datetimezone},
        {"fim", type datetimezone}, {"status", type text}}, "en-US"),
    Dia = Table.AddColumn(Tipos, "dia", each Date.From(DateTimeZone.RemoveZone([inicio])), type date)
in
    Dia


// -------------------------------------------------------------------------------------
// Nome: aprovacoes
// -------------------------------------------------------------------------------------
let
    Fonte = fnLerCsv("aprovacoes"),
    Tipos = Table.TransformColumnTypes(Fonte, {
        {"aprovacao_id", Int64.Type}, {"acao", type text}, {"nivel", Int64.Type}, {"assunto_tipo", type text},
        {"assunto_id", Int64.Type}, {"resumo", type text}, {"status", type text}, {"decidido_por", type text},
        {"criado_em", type datetimezone}, {"decidido_em", type datetimezone}}, "en-US")
in
    Tipos


// -------------------------------------------------------------------------------------
// Nome: custos_ferramentas
// -------------------------------------------------------------------------------------
let
    Fonte = fnLerCsv("custos_ferramentas"),
    Tipos = Table.TransformColumnTypes(Fonte, {
        {"integracao", type text}, {"dia", type date}, {"chamadas", Int64.Type}, {"custo_estimado", type number}}, "en-US")
in
    Tipos


// -------------------------------------------------------------------------------------
// Nome: contatos_canal   (e-mails já chegam mascarados)
// -------------------------------------------------------------------------------------
let
    Fonte = fnLerCsv("contatos_canal"),
    Tipos = Table.TransformColumnTypes(Fonte, {
        {"contato_id", Int64.Type}, {"empresa_id", Int64.Type}, {"tipo", type text}, {"base_legal", type text},
        {"status", type text}, {"email_mascarado", type text}, {"criado_em", type datetimezone}}, "en-US")
in
    Tipos
