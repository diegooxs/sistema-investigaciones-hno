param(
  [ValidateSet('backup', 'list', 'restore')]
  [string]$Action = 'backup',
  [string]$BackupPath,
  [switch]$ConfirmRestore
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$RuntimeRoot = Join-Path $ProjectRoot '.runtime'
$BinRoot = Join-Path $RuntimeRoot 'server\mariadb-11.4.10-winx64\bin'
$BackupRoot = Join-Path $ProjectRoot 'backups'

function Import-DotEnv {
  $envFile = Join-Path $ProjectRoot '.env'
  if (-not (Test-Path -LiteralPath $envFile)) { throw 'No existe .env. Copia .env.example y configura las credenciales.' }
  foreach ($line in Get-Content -LiteralPath $envFile) {
    if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
    $name, $value = $line -split '=', 2
    if (-not [Environment]::GetEnvironmentVariable($name.Trim(), 'Process')) {
      [Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim(), 'Process')
    }
  }
}

Import-DotEnv
$Port = if ($env:DB_PORT) { [int]$env:DB_PORT } else { 3306 }
$DatabaseName = if ($env:DB_NAME) { $env:DB_NAME } else { 'hno_investigaciones' }
$DatabaseUser = if ($env:DB_USER) { $env:DB_USER } else { 'hno_app' }
$DatabasePassword = $env:DB_PASSWORD
$Client = Join-Path $BinRoot 'mariadb.exe'
$Dump = Join-Path $BinRoot 'mariadb-dump.exe'

function Get-Sha256([string]$Path) {
  $stream = [System.IO.File]::OpenRead($Path)
  try {
    $algorithm = [System.Security.Cryptography.SHA256]::Create()
    try {
      return ([System.BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace('-', '')
    }
    finally { $algorithm.Dispose() }
  }
  finally { $stream.Dispose() }
}

if ($Action -eq 'list') {
  New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null
  Get-ChildItem -LiteralPath $BackupRoot -Directory | Sort-Object Name -Descending | Select-Object Name, LastWriteTime
  exit 0
}

& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'mariadb-local.ps1') start
if ($LASTEXITCODE -ne 0) { throw 'No fue posible iniciar MariaDB.' }

if ($Action -eq 'backup') {
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $target = Join-Path $BackupRoot $stamp
  New-Item -ItemType Directory -Force -Path $target | Out-Null
  $sql = Join-Path $target 'hno_investigaciones.sql'
  & $Dump --host=127.0.0.1 --port=$Port --user=$DatabaseUser "--password=$DatabasePassword" --single-transaction --routines --events --hex-blob "--result-file=$sql" $DatabaseName
  if ($LASTEXITCODE -ne 0) { throw 'No fue posible generar el respaldo de MariaDB.' }
  $hash = Get-Sha256 $sql
  @{
    createdAt = (Get-Date).ToString('o')
    database = $DatabaseName
    mariadbVersion = '11.4.10'
    file = 'hno_investigaciones.sql'
    sha256 = $hash
  } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $target 'manifest.json') -Encoding UTF8
  Write-Host "Respaldo creado y verificado en $target"
  exit 0
}

if (-not $BackupPath) { throw 'Indica -BackupPath con la carpeta del respaldo.' }
$resolved = (Resolve-Path -LiteralPath $BackupPath).Path
$sql = Join-Path $resolved 'hno_investigaciones.sql'
$manifestPath = Join-Path $resolved 'manifest.json'
if (-not (Test-Path -LiteralPath $sql) -or -not (Test-Path -LiteralPath $manifestPath)) { throw 'El respaldo no contiene SQL y manifiesto.' }
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$actualHash = Get-Sha256 $sql
if ($actualHash -ne $manifest.sha256) { throw 'El respaldo está dañado: la suma SHA-256 no coincide.' }
if (-not $ConfirmRestore) { throw 'La restauración reemplaza los datos actuales. Repite con -ConfirmRestore.' }
$safeSql = $sql.Replace('\', '/')
& $Client --host=127.0.0.1 --port=$Port --user=$DatabaseUser "--password=$DatabasePassword" "--database=$DatabaseName" "--execute=source $safeSql"
if ($LASTEXITCODE -ne 0) { throw 'No fue posible restaurar el respaldo.' }
Write-Host "Respaldo restaurado y verificado desde $resolved"
