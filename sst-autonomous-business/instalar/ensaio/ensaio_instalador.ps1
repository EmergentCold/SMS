# Ensaio do instalador do Windows em Linux: cmdlets exclusivos do Windows são substituídos por funções que
# registram a chamada. Git, Python, testes, pastas e arquivos são reais.
param([string]$Repositorio, [string]$Raiz)
$ErrorActionPreference = 'Stop'
$global:Chamadas = [System.Collections.Generic.List[string]]::new()

Remove-Item -Recurse -Force $Raiz -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path "$Raiz/home/Desktop/Segurança do Trabalho em Projetos/PGR" | Out-Null
Set-Content "$Raiz/home/Desktop/Segurança do Trabalho em Projetos/PGR/inventario_riscos.xlsx" 'x'
Set-Content "$Raiz/home/Desktop/Segurança do Trabalho em Projetos/ASO_joao_silva.pdf" 'x'
Set-Content "$Raiz/home/Desktop/Segurança do Trabalho em Projetos/checklist_nr35.docx" 'x'
New-Item -ItemType Directory -Force -Path "$Raiz/OneDrive - Empresa" | Out-Null

$env:SST_INSTALADOR_TESTE = '1'
$env:USERPROFILE = "$Raiz/home"
$env:HOME = "$Raiz/home"
$env:OneDriveCommercial = "$Raiz/OneDrive - Empresa"
$env:USERDOMAIN = 'EMPRESA'
$env:USERNAME = 'tecnico'

function global:winget { $global:Chamadas.Add("winget $($args -join ' ')"); $global:LASTEXITCODE = 0 }
function global:icacls { $global:Chamadas.Add("icacls $($args -join ' ')"); $global:LASTEXITCODE = 0 }
function global:Set-Clipboard { param($Value) $global:Chamadas.Add("Set-Clipboard (len $($Value.Length))") }
function global:Start-Process { param($FilePath) $global:Chamadas.Add("Start-Process $FilePath") }
function global:New-ScheduledTaskSettingsSet { [pscustomobject]@{ tipo = 'settings'; args = $args -join ' ' } }
function global:New-ScheduledTaskTrigger { param([switch]$AtLogOn, $User) [pscustomobject]@{ AtLogOn = [bool]$AtLogOn; User = $User } }
function global:New-ScheduledTaskAction { param($Execute, $Argument, $WorkingDirectory)
    [pscustomobject]@{ Execute = $Execute; Argument = $Argument; WorkingDirectory = $WorkingDirectory } }
function global:Register-ScheduledTask { param($TaskName, $Action, $Trigger, $Settings, $Description, [switch]$Force)
    $global:Chamadas.Add("Register-ScheduledTask '$TaskName' exe=$($Action.Execute) args='$($Action.Argument)' cwd=$($Action.WorkingDirectory) user=$($Trigger.User) logon=$($Trigger.AtLogOn)") }
function global:Start-ScheduledTask { param($TaskName) $global:Chamadas.Add("Start-ScheduledTask '$TaskName'") }
function global:Get-ScheduledTask { param($TaskName) $null }

$instalador = Join-Path (Split-Path $PSScriptRoot) 'instalar_windows.ps1'
& $instalador -SimParaTudo -Destino "$Raiz/home/sst-agent" -Repositorio $Repositorio
Write-Host ''
Write-Host '---- CHAMADAS SIMULADAS ----'
$global:Chamadas | ForEach-Object { Write-Host "  $_" }
