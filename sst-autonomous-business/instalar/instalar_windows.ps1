<#
.SYNOPSIS
  Instala e configura o SST Agent no Windows, pedindo permissão antes de cada passo.

.DESCRIPTION
  1. Instala (via winget) Git, Python 3.12 e, opcionalmente, Power BI Desktop e Node.js.
  2. Baixa/atualiza o repositório.
  3. Cria a pasta SST-Agent no OneDrive (ponte com Power Automate / Power Apps / Power BI).
  4. Cria o arquivo .env com tokens aleatórios e protege o acesso a ele.
  5. Configura sua identidade comercial (nome, marca, e-mail) — opcional.
  6. Roda os testes, a simulação e a primeira exportação para o Power BI.
  7. Registra o agente como tarefa agendada (inicia com o Windows) e, opcionalmente, a API + painel web.
  8. Opcional: copia a pasta "Segurança do Trabalho em Projetos" da Área de Trabalho para o repositório.
  9. Abre os guias e os sites do Power Automate / Power Apps.

  Nada é enviado a terceiros e nenhum e-mail é disparado: o envio externo continua DESLIGADO.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\instalar_windows.ps1
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\instalar_windows.ps1 -Remover
#>
[CmdletBinding()]
param(
    [string]$Destino = (Join-Path $env:USERPROFILE 'sst-agent'),
    [string]$Branch = 'main',
    [string]$Repositorio = 'https://github.com/EmergentCold/tavarez-sst.git',
    [switch]$SimParaTudo,
    [switch]$Remover
)

$ErrorActionPreference = 'Stop'
$TarefaAgente = 'SST Agent'
$TarefaApi = 'SST Agent API'

function Passo([string]$texto) { Write-Host ''; Write-Host "==> $texto" -ForegroundColor Cyan }
function Ok([string]$texto) { Write-Host "    OK: $texto" -ForegroundColor Green }
function Aviso([string]$texto) { Write-Host "    ATENÇÃO: $texto" -ForegroundColor Yellow }

function Perguntar([string]$texto, [bool]$padraoSim = $true) {
    if ($SimParaTudo) { return $padraoSim }
    $sufixo = '[s/N]'
    if ($padraoSim) { $sufixo = '[S/n]' }
    $r = Read-Host "    $texto $sufixo"
    if ([string]::IsNullOrWhiteSpace($r)) { return $padraoSim }
    return ($r.Trim() -match '^(s|sim|y|yes)$')
}

function Tem([string]$cmd) { return [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }

function Atualizar-Path {
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
                [Environment]::GetEnvironmentVariable('Path', 'User')
}

function Instalar-Winget([string]$id, [string]$nome, [bool]$padraoSim = $true) {
    if (-not (Tem 'winget')) {
        Aviso "winget não encontrado. Instale '$nome' manualmente (Microsoft Store > 'Instalador de Aplicativo')."
        return $false
    }
    if (-not (Perguntar "Instalar $nome (winget id: $id)?" $padraoSim)) { return $false }
    & winget install -e --id $id --accept-source-agreements --accept-package-agreements
    Atualizar-Path
    if ($LASTEXITCODE -ne 0) { Aviso "winget terminou com código $LASTEXITCODE para $nome."; return $false }
    Ok "$nome instalado"
    return $true
}

function Novo-Token {
    $bytes = New-Object byte[] 32
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    return ([Convert]::ToBase64String($bytes) -replace '[+/=]', '')
}

function Encontrar-Python {
    $candidatos = @(@('py', '-3'), @('python'), @('python3'))
    foreach ($c in $candidatos) {
        if (-not (Tem $c[0])) { continue }
        try {
            $extra = @()
            if ($c.Length -gt 1) { $extra = $c[1..($c.Length - 1)] }
            $versao = & $c[0] @extra -c "import sys; print('%d.%d' % sys.version_info[:2]); print(sys.executable)" 2>$null
            if ($LASTEXITCODE -eq 0 -and $versao) {
                $partes = ($versao[0]).Split('.')
                if ([int]$partes[0] -eq 3 -and [int]$partes[1] -ge 11) { return $versao[1].Trim() }
            }
        } catch { }
    }
    return $null
}

function Ler-Env([string]$arquivo) {
    $mapa = @{}
    foreach ($linha in [IO.File]::ReadAllLines($arquivo)) {
        if ($linha -match '^\s*([A-Z0-9_]+)\s*=(.*)$') { $mapa[$Matches[1]] = $Matches[2].Trim() }
    }
    return $mapa
}

function Definir-Env([string]$arquivo, [string]$chave, [string]$valor, [bool]$sobrescrever = $false) {
    $linhas = [Collections.Generic.List[string]]::new()
    $linhas.AddRange([IO.File]::ReadAllLines($arquivo))
    $achou = $false
    for ($i = 0; $i -lt $linhas.Count; $i++) {
        if ($linhas[$i] -match "^\s*#?\s*$chave\s*=(.*)$") {
            $achou = $true
            if ($sobrescrever -or [string]::IsNullOrWhiteSpace($Matches[1]) -or $linhas[$i].TrimStart().StartsWith('#')) {
                $linhas[$i] = "$chave=$valor"
            }
            break
        }
    }
    if (-not $achou) { $linhas.Add("$chave=$valor") }
    [IO.File]::WriteAllLines($arquivo, $linhas, (New-Object Text.UTF8Encoding $false))
}

function Rodar-Python([string[]]$argumentos) {
    & $script:PythonExe @argumentos
    if ($LASTEXITCODE -ne 0) { throw "falhou: python $($argumentos -join ' ')" }
}

# ----------------------------------------------------------------------------------------- início
if ([Environment]::OSVersion.Platform -ne 'Win32NT' -and -not $env:SST_INSTALADOR_TESTE) {
    Write-Host 'Este instalador é para Windows. No Linux/macOS, siga o README (python3 -m src.main ...).'
    exit 1
}

if ($Remover) {
    Passo 'Removendo tarefas agendadas do SST Agent'
    foreach ($t in @($TarefaAgente, $TarefaApi)) {
        if (Get-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue) {
            Stop-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue
            Unregister-ScheduledTask -TaskName $t -Confirm:$false
            Ok "tarefa '$t' removida"
        }
    }
    Write-Host '    Pastas e banco de dados foram mantidos. Apague-os manualmente se quiser.'
    exit 0
}

Write-Host 'Instalador do SST Agent — cada etapa pede sua confirmação (Enter = sim).' -ForegroundColor White
Write-Host 'Nenhum e-mail será enviado: o envio externo permanece desligado até você habilitá-lo.'

# 1. Programas --------------------------------------------------------------------------------------
Passo '1/9 Programas necessários'
if (Tem 'git') { Ok 'Git já instalado' } else { [void](Instalar-Winget 'Git.Git' 'Git') }
$script:PythonExe = Encontrar-Python
if ($script:PythonExe) { Ok "Python encontrado: $script:PythonExe" }
else {
    [void](Instalar-Winget 'Python.Python.3.12' 'Python 3.12')
    $script:PythonExe = Encontrar-Python
}
if (-not $script:PythonExe) { throw 'Python 3.11+ não encontrado. Instale pelo site python.org e rode de novo.' }
if (-not (Tem 'git')) { throw 'Git não encontrado. Instale e rode de novo.' }
if (-not (Instalar-Winget 'Microsoft.PowerBI' 'Power BI Desktop (para o relatório)' $true)) {
    Aviso 'se o winget falhar (ex.: "hash does not match"), instale o Power BI Desktop pela Microsoft Store.'
}
if (-not (Tem 'node')) { [void](Instalar-Winget 'OpenJS.NodeJS.LTS' 'Node.js (opcional; testes do painel JavaScript)' $false) }

# 2. Repositório -----------------------------------------------------------------------------------
Passo "2/9 Código do agente em $Destino"
if (Test-Path (Join-Path $Destino '.git')) {
    if (Perguntar 'Atualizar o código existente (git pull)?') {
        & git -C $Destino fetch origin $Branch
        & git -C $Destino checkout $Branch
        & git -C $Destino pull --ff-only origin $Branch
    }
} else {
    if (-not (Perguntar "Baixar o repositório $Repositorio (branch $Branch)?")) { throw 'Cancelado pelo usuário.' }
    & git clone --branch $Branch $Repositorio $Destino
    if ($LASTEXITCODE -ne 0) { throw 'git clone falhou (repositório privado? faça login quando o Git pedir).' }
}
# Repositório próprio (tavarez-sst): projeto na raiz. Cópias antigas (SMS): projeto na subpasta.
$Projeto = $Destino
if (Test-Path (Join-Path $Destino 'sst-autonomous-business/src')) { $Projeto = Join-Path $Destino 'sst-autonomous-business' }
Set-Location $Projeto
Ok "projeto em $Projeto"

# 3. Pasta do OneDrive -----------------------------------------------------------------------------
Passo '3/9 Pasta de integração no OneDrive (Power Automate / Power Apps / Power BI)'
$OneDrive = $env:OneDriveCommercial
if (-not $OneDrive) { $OneDrive = $env:OneDrive }
$PastaPonte = $null
if ($OneDrive) {
    $sugestao = Join-Path $OneDrive 'SST-Agent'
    if (Perguntar "Usar $sugestao como pasta da ponte?") { $PastaPonte = $sugestao }
}
if (-not $PastaPonte) {
    $PastaPonte = Read-Host '    Informe o caminho de uma pasta sincronizada (vazio = pular)'
}
if ($PastaPonte) {
    foreach ($sub in @('', 'export', 'inbox', 'outbox', 'aprovacoes')) {
        New-Item -ItemType Directory -Force -Path (Join-Path $PastaPonte $sub) | Out-Null
    }
    foreach ($sub in @('envios', 'envios\confirmados', 'envios\falhas')) {
        New-Item -ItemType Directory -Force -Path (Join-Path $PastaPonte $sub) | Out-Null
    }
    Ok "pasta criada: $PastaPonte"
} else { Aviso 'sem pasta da ponte: Power Automate/Power Apps (modo padrão) não terão onde ler/gravar.' }

# 4. Arquivo .env ----------------------------------------------------------------------------------
Passo '4/9 Arquivo de configuração .env (credenciais ficam só neste computador)'
$EnvArq = Join-Path $Projeto '.env'
if (-not (Test-Path $EnvArq)) { Copy-Item (Join-Path $Projeto '.env.example') $EnvArq; Ok '.env criado a partir do modelo' }
$atual = Ler-Env $EnvArq
if ($PastaPonte) { Definir-Env $EnvArq 'POWERPLATFORM_DIR' $PastaPonte }
if (-not $atual['SST_BRIDGE_TOKEN']) { Definir-Env $EnvArq 'SST_BRIDGE_TOKEN' (Novo-Token); Ok 'token da ponte gerado' }
if (-not $atual['SST_API_TOKEN']) { Definir-Env $EnvArq 'SST_API_TOKEN' (Novo-Token); Ok 'token da API gerado' }
$GmailConfigurado = $false
if ((-not $SimParaTudo) -and (Perguntar 'Usar um Gmail GRATUITO para enviar e receber (recomendado enquanto não houver domínio)?')) {
    Write-Host '    Antes: ative a verificação em duas etapas no Gmail e crie uma "senha de app"'
    Write-Host '    (myaccount.google.com > Segurança > Senhas de app). A senha não aparece na tela.'
    $gmail = (Read-Host '    Endereço Gmail (ex.: tavarezsst@gmail.com)').Trim().ToLower()
    if ($gmail -notmatch '^[a-z0-9._%+\-]+@gmail\.com$') {
        Aviso 'endereço não parece ser um Gmail; envio não configurado.'
    } else {
        $seguro = Read-Host '    Senha de app (16 letras)' -AsSecureString
        $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($seguro)
        try { $senha = ([Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)) -replace '\s', '' }
        finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
        $valores = [ordered]@{
            'EMAIL_CHANNEL' = 'smtp'; 'SMTP_HOST' = 'smtp.gmail.com'; 'SMTP_PORT' = '587'; 'SMTP_SECURITY' = 'starttls'
            'SMTP_USER' = $gmail; 'SMTP_PASSWORD' = $senha; 'SMTP_FROM' = $gmail
            'IMAP_HOST' = 'imap.gmail.com'; 'IMAP_PORT' = '993'; 'IMAP_USER' = $gmail; 'IMAP_PASSWORD' = $senha
        }
        foreach ($k in $valores.Keys) { Definir-Env $EnvArq $k $valores[$k] $true }
        $senha = $null
        $GmailConfigurado = $true
        Ok "envio e leitura de respostas pelo Gmail configurados ($gmail); senha gravada só no .env"
    }
}
if ((-not $GmailConfigurado) -and $PastaPonte -and (Perguntar 'Seu e-mail comercial é Microsoft 365? Enviar pelo Power Automate/Outlook (sem senha SMTP)?' $false)) {
    Definir-Env $EnvArq 'EMAIL_CHANNEL' 'power_automate' $true
    Ok 'canal de envio: Power Automate (crie o fluxo 9 "SST – Enviar e-mails")'
}
if (Perguntar 'Restringir o .env para que só o seu usuário possa lê-lo?') {
    & icacls $EnvArq /inheritance:r /grant:r "$($env:USERDOMAIN)\$($env:USERNAME):(R,W)" | Out-Null
    if ($LASTEXITCODE -ne 0) { Aviso 'icacls falhou; o .env manteve as permissões padrão.' }
    Ok 'permissões do .env restritas'
}

# 5. Identidade comercial -------------------------------------------------------------------------
Passo '5/9 Sua identidade comercial (aparece nas mensagens; sem ela nada é preparado para envio)'
if ((-not $SimParaTudo) -and (Perguntar 'Preencher agora nome, marca e e-mail comercial?')) {
    $nome = Read-Host '    Seu nome completo'
    $marca = Read-Host '    Nome comercial (Enter = seu nome)'
    if (-not $marca) { $marca = $nome }
    $email = Read-Host '    E-mail comercial (o Gmail configurado acima, ou o do seu domínio)'
    $tel = Read-Host '    Telefone comercial (opcional)'
    $horas = Read-Host '    Horas por semana disponíveis para atender clientes (ex.: 10)'
    $contratos = Read-Host '    Máximo de contratos simultâneos (ex.: 3)'
    $argsId = @('instalar\configurar_identidade.py', '--nome', $nome, '--marca', $marca, '--email', $email)
    if ($tel) { $argsId += @('--telefone', $tel) }
    if ($horas -match '^\d+$') { $argsId += @('--horas-semana', $horas) }
    if ($contratos -match '^\d+$') { $argsId += @('--contratos-max', $contratos) }
    Rodar-Python $argsId
}
Aviso 'revise a tabela de preços (knowledge\tabela_precos.md / config\pricing.json) antes de enviar propostas.'

# 6. Verificação ----------------------------------------------------------------------------------
Passo '6/9 Verificação (testes, simulação sem envio e primeira exportação)'
if (Perguntar 'Instalar o pytest e rodar os testes automatizados?') {
    Rodar-Python @('-m', 'pip', 'install', '--user', '--quiet', 'pytest')
    Rodar-Python @('-m', 'pytest', '-q')
}
Rodar-Python @('-m', 'src.main', 'init')
if (Perguntar 'Rodar a simulação (dados fictícios, nada sai do computador)?') { Rodar-Python @('-m', 'src.main', 'simulate') | Out-Null; Ok 'simulação concluída (relatório em reports\simulation)' }
Rodar-Python @('-m', 'src.main', 'powerbi-export')
Ok 'arquivos para Power BI/Power Apps exportados'
Rodar-Python @('-m', 'src.main', 'integrations', '--offline')
if ($GmailConfigurado -and (Perguntar 'Testar agora o login no Gmail (não envia nenhuma mensagem)?')) {
    & $script:PythonExe -c "from src.app import build_app; from src.integrations.email_smtp import SmtpEmailChannel; from src.integrations.email_imap import ImapInbox; build_app(); [print('   ', s.name, '->', s.detail) for s in (SmtpEmailChannel().verify(), ImapInbox().verify())]"
}

# 7. Execução contínua ----------------------------------------------------------------------------
Passo '7/9 Execução contínua (tarefa agendada do Windows)'
$Pythonw = Join-Path (Split-Path $script:PythonExe) 'pythonw.exe'
if (-not (Test-Path $Pythonw)) { $Pythonw = $script:PythonExe }
$config = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
    -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5) -ExecutionTimeLimit ([TimeSpan]::Zero)
$Usuario = "$env:USERDOMAIN\$env:USERNAME"
$gatilho = New-ScheduledTaskTrigger -AtLogOn -User $Usuario
if (Perguntar "Registrar o agente para iniciar com o Windows (tarefa '$TarefaAgente') e iniciar agora?") {
    $acao = New-ScheduledTaskAction -Execute $Pythonw -Argument '-m src.main daemon' -WorkingDirectory $Projeto
    Register-ScheduledTask -TaskName $TarefaAgente -Action $acao -Trigger $gatilho -Settings $config `
        -Description 'SST Agent: agendador (pesquisa, qualificação, follow-ups, relatórios, ponte Power Platform)' -Force | Out-Null
    Start-ScheduledTask -TaskName $TarefaAgente
    Ok "tarefa '$TarefaAgente' registrada e iniciada"
}
if (Perguntar "Registrar também a API + painel web (http://127.0.0.1:8765, tarefa '$TarefaApi')?") {
    $acaoApi = New-ScheduledTaskAction -Execute $Pythonw -Argument '-m src.main api' -WorkingDirectory $Projeto
    Register-ScheduledTask -TaskName $TarefaApi -Action $acaoApi -Trigger $gatilho -Settings $config `
        -Description 'SST Agent: API REST e painel JavaScript (somente localhost)' -Force | Out-Null
    Start-ScheduledTask -TaskName $TarefaApi
    Ok "painel em http://127.0.0.1:8765 (token: SST_API_TOKEN do .env)"
}

# 8. Pasta da Área de Trabalho --------------------------------------------------------------------
Passo '8/9 Pasta "Segurança do Trabalho em Projetos" da Área de Trabalho'
$Desktop = [Environment]::GetFolderPath('Desktop')
$Origem = Get-ChildItem -Path $Desktop -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like 'Seguran*Trabalho*Projeto*' } | Select-Object -First 1
if (-not $Origem) {
    Aviso "pasta não encontrada em $Desktop (procure por 'Segurança do Trabalho em Projetos')."
} else {
    $arquivos = Get-ChildItem -Path $Origem.FullName -Recurse -File
    $tamanhoMb = [math]::Round((($arquivos | Measure-Object Length -Sum).Sum) / 1MB, 1)
    $suspeitos = $arquivos | Where-Object { $_.Name -match '(?i)(aso|cpf|rg|ficha|funcion|colaborador|exame|atestado|salario|holerite)' }
    Write-Host "    Encontrada: $($Origem.FullName) ($($arquivos.Count) arquivos, $tamanhoMb MB)"
    if ($suspeitos) {
        Aviso "$($suspeitos.Count) arquivo(s) com nome que sugere dados pessoais (ex.: $($suspeitos[0].Name))."
    }
    Aviso 'não envie dados pessoais de colaboradores (ASO, CPF, fichas) ao GitHub, mesmo em repositório privado.'
    if (Perguntar 'Copiar a pasta para o repositório (seguranca-do-trabalho-em-projetos)?' $false) {
        $Alvo = Join-Path $Destino 'seguranca-do-trabalho-em-projetos'
        Copy-Item -Path $Origem.FullName -Destination $Alvo -Recurse -Force
        Ok "copiada para $Alvo"
        if ($tamanhoMb -gt 90) { Aviso 'pasta grande: arquivos acima de 100 MB são recusados pelo GitHub.' }
        if (Perguntar 'Enviar (commit + push) para o GitHub agora?' $false) {
            & git -C $Destino add 'seguranca-do-trabalho-em-projetos'
            & git -C $Destino commit -m 'Adiciona pasta Segurança do Trabalho em Projetos'
            & git -C $Destino push origin $Branch
            if ($LASTEXITCODE -eq 0) { Ok 'enviado ao GitHub' } else { Aviso 'push falhou; rode "git push" manualmente.' }
        }
    }
}

# 9. Power Platform -------------------------------------------------------------------------------
Passo '9/9 Power Automate, Power Apps e Power BI (montagem guiada no seu Microsoft 365)'
$tokenPonte = (Ler-Env $EnvArq)['SST_BRIDGE_TOKEN']
if ($tokenPonte -and (Perguntar 'Copiar o token da ponte para a área de transferência (usado nos fluxos)?')) {
    Set-Clipboard -Value $tokenPonte
    Ok 'token copiado — cole na variável "token" dos fluxos; não compartilhe'
}
if (Perguntar 'Abrir os guias e os sites do Power Automate e do Power Apps?') {
    Start-Process (Join-Path $Projeto 'powerplatform\power-automate\FLUXOS.md')
    Start-Process (Join-Path $Projeto 'powerplatform\power-apps\APP.md')
    Start-Process (Join-Path $Projeto 'powerplatform\power-bi\MODELO.md')
    Start-Process 'https://make.powerautomate.com'
    Start-Process 'https://make.powerapps.com'
}

Write-Host ''
Write-Host 'Concluído.' -ForegroundColor Green
Write-Host "  Projeto ............ $Projeto"
Write-Host "  Pasta da ponte ..... $PastaPonte"
Write-Host '  Estado ............. python -m src.main status   (na pasta do projeto)'
Write-Host '  Pausar envios ...... python -m src.main kill-switch on'
Write-Host '  Remover tarefas .... instalar_windows.ps1 -Remover'
Write-Host '  Envio externo ...... DESLIGADO. Para ligar: configure SMTP no .env, rode "integrations" e'
Write-Host '                       defina EXTERNAL_SENDING_ENABLED=true.'
