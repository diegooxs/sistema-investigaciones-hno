param(
  [ValidateSet('prepare', 'start', 'status', 'stop')]
  [string]$Action = 'status'
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$RuntimeRoot = Join-Path $ProjectRoot '.runtime'
$ProcessRoot = Join-Path $RuntimeRoot 'processes'
$ApiPid = Join-Path $ProcessRoot 'api.pid'
$WebPid = Join-Path $ProcessRoot 'web.pid'
$ApiLog = Join-Path $ProcessRoot 'api.log'
$WebLog = Join-Path $ProcessRoot 'web.log'
$ApiErrorLog = Join-Path $ProcessRoot 'api-error.log'
$WebErrorLog = Join-Path $ProcessRoot 'web-error.log'

function Get-SavedProcess([string]$PidPath) {
  if (-not (Test-Path -LiteralPath $PidPath)) { return $null }
  $savedPid = [int](Get-Content -LiteralPath $PidPath -Raw)
  return Get-Process -Id $savedPid -ErrorAction SilentlyContinue
}

function Stop-SavedProcess([string]$PidPath) {
  $process = Get-SavedProcess $PidPath
  if ($process) { Stop-Process -Id $process.Id -Force }
  Remove-Item -LiteralPath $PidPath -Force -ErrorAction SilentlyContinue
}

if ($Action -eq 'prepare') {
  & pnpm install --frozen-lockfile
  if ($LASTEXITCODE -ne 0) { throw 'Falló la instalación reproducible de dependencias.' }
  & pnpm check
  if ($LASTEXITCODE -ne 0) { throw 'Fallaron las pruebas o la compilación.' }
  & pnpm db:up
  if ($LASTEXITCODE -ne 0) { throw 'No fue posible iniciar MariaDB.' }
  & pnpm test:db
  if ($LASTEXITCODE -ne 0) { throw 'Fallaron las pruebas de integración con MariaDB.' }
  Write-Host 'Preparación técnica aprobada: dependencias, pruebas, compilación y persistencia.'
  exit 0
}

if ($Action -eq 'status') {
  $api = Get-SavedProcess $ApiPid
  $web = Get-SavedProcess $WebPid
  if ($api) { Write-Host "API activa con PID $($api.Id)." } else { Write-Host 'API detenida.' }
  if ($web) { Write-Host "Interfaz activa con PID $($web.Id)." } else { Write-Host 'Interfaz detenida.' }
  & pnpm db:status
  exit 0
}

if ($Action -eq 'stop') {
  Stop-SavedProcess $ApiPid
  Stop-SavedProcess $WebPid
  & pnpm db:down
  Write-Host 'Aplicación y base de datos detenidas.'
  exit 0
}

New-Item -ItemType Directory -Force -Path $ProcessRoot | Out-Null
& pnpm db:up
if ($LASTEXITCODE -ne 0) { throw 'No fue posible iniciar MariaDB.' }
if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot 'apps\web\dist\index.html'))) {
  & pnpm build
  if ($LASTEXITCODE -ne 0) { throw 'No fue posible compilar la interfaz.' }
}
if (-not (Get-SavedProcess $ApiPid)) {
  $api = Start-Process -FilePath 'pnpm.cmd' -ArgumentList @('--filter', '@hno/api', 'start') -WorkingDirectory $ProjectRoot -RedirectStandardOutput $ApiLog -RedirectStandardError $ApiErrorLog -WindowStyle Hidden -PassThru
  Set-Content -LiteralPath $ApiPid -Value $api.Id
}
if (-not (Get-SavedProcess $WebPid)) {
  $web = Start-Process -FilePath 'pnpm.cmd' -ArgumentList @('--filter', '@hno/web', 'preview', '--host', '127.0.0.1', '--port', '4173') -WorkingDirectory $ProjectRoot -RedirectStandardOutput $WebLog -RedirectStandardError $WebErrorLog -WindowStyle Hidden -PassThru
  Set-Content -LiteralPath $WebPid -Value $web.Id
}
Start-Sleep -Seconds 2
try { Invoke-RestMethod -Uri 'http://127.0.0.1:3001/api/health' -TimeoutSec 5 | Out-Null } catch { throw 'La API no superó la comprobación de salud. Revisa .runtime/processes/api.log.' }
Write-Host 'Entorno local de entrega disponible en http://127.0.0.1:4173'
