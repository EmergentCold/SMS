# Conector personalizado "SST Agent" (Modo B — Premium)

Arquivo: `apiDefinition.swagger.json` (OpenAPI 2.0). Regenere sempre que mudar o domínio:

```bash
python -m src.main openapi --host sst.seudominio.com.br --output powerplatform/custom-connector/apiDefinition.swagger.json
```

## Importar

1. Em make.powerapps.com (ou make.powerautomate.com): **Dados → Conectores personalizados → Novo conector
   personalizado → Importar um arquivo OpenAPI**. Nome: `SST Agent`. Selecione o arquivo.
2. **Geral:** confira Esquema `HTTPS`, Host `sst.seudominio.com.br`, URL base `/`.
3. **Segurança:** Tipo de autenticação `Chave de API`; Rótulo do parâmetro `Token`; Nome do parâmetro
   `X-API-Key`; Local `Cabeçalho`.
4. **Definição:** as 9 operações já vêm com nomes e resumos em português:

| Operação | Uso típico |
|---|---|
| `ObterPainel` | Tela inicial do app (KPIs, pipeline, aprovações, leads) |
| `ListarLeads` | Galeria de leads (filtro `status`) |
| `ImportarLeads` | Fluxo que lê planilha Excel e envia linhas com origem |
| `ListarAprovacoes` | Fluxo de aprovações / galeria do app |
| `DecidirAprovacao` | Botões Aprovar/Rejeitar, resposta de aprovação do Teams |
| `ListarMensagens` | Histórico |
| `RegistrarResposta` | Fluxo "Quando chega um novo e-mail" do Outlook |
| `KillSwitch` | Botão de pausa no celular |
| `ExecutarRotina` | Rodar qualificação, follow-ups, relatório, exportação |

5. **Criar conector → Testar:** nova conexão com o valor de `SST_API_TOKEN`; teste `ObterPainel`.

## Requisitos

- Licença Premium para quem usa o conector (Power Apps/Power Automate).
- A API precisa estar acessível por HTTPS público (túnel) **ou** via gateway de dados local
  (marque "Conectar via gateway de dados local" na aba Geral).
- O token fica armazenado na conexão do Power Platform, não no app nem no fluxo.
