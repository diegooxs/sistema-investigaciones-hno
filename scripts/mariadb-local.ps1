param(
  [ValidateSet('install', 'start', 'stop', 'status', 'console', 'tables')]
  [string]$Action = 'start'
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$RuntimeRoot = Join-Path $ProjectRoot '.runtime'
$Version = '11.4.10'
$ArchiveName = "mariadb-$Version-winx64.zip"
$ExpectedSha256 = 'fb7c76f0804321ee373daa49145f2056d2d88f321b614130adeb05a1644ea003'
$DownloadUrl = "https://downloads.mariadb.org/rest-api/mariadb/$Version/$ArchiveName"
$ArchivePath = Join-Path $RuntimeRoot "downloads\$ArchiveName"
$ServerRoot = Join-Path $RuntimeRoot "server\mariadb-$Version-winx64"
$BinRoot = Join-Path $ServerRoot 'bin'
$DataRoot = Join-Path $RuntimeRoot 'data'
$ConfigPath = Join-Path $DataRoot 'my.ini'
$PidFile = Join-Path $RuntimeRoot 'mariadb.pid'
$LogFile = Join-Path $RuntimeRoot 'mariadb.log'

function Import-DotEnv {
  $envFile = Join-Path $ProjectRoot '.env'
  if (-not (Test-Path -LiteralPath $envFile)) { return }
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
$DatabasePassword = if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { 'cambiar_en_desarrollo' }
$RootPassword = if ($env:MARIADB_ROOT_PASSWORD) { $env:MARIADB_ROOT_PASSWORD } else { 'root_hno_2027' }

function Test-MariaDbReady {
  $admin = Join-Path $BinRoot 'mariadb-admin.exe'
  if (-not (Test-Path -LiteralPath $admin)) { return $false }
  # Cuando el servidor está apagado, mariadb-admin escribe en stderr. Esa es una
  # respuesta esperada durante el arranque y no debe convertirse en un error
  # terminante por el ErrorActionPreference global del script.
  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    & $admin --host=127.0.0.1 --port=$Port --user=root "--password=$RootPassword" ping 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
  }
  finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
}

function Install-MariaDbPortable {
  if (Test-Path -LiteralPath (Join-Path $BinRoot 'mariadbd.exe')) { return }
  New-Item -ItemType Directory -Path (Split-Path -Parent $ArchivePath) -Force | Out-Null
  New-Item -ItemType Directory -Path (Split-Path -Parent $ServerRoot) -Force | Out-Null
  if (-not (Test-Path -LiteralPath $ArchivePath)) {
    Write-Host "Descargando MariaDB $Version desde mariadb.org..."
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $ArchivePath
  }
  $hash = (Get-FileHash -LiteralPath $ArchivePath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($hash -ne $ExpectedSha256) { throw 'La descarga de MariaDB no coincide con la suma SHA-256 oficial.' }
  Expand-Archive -LiteralPath $ArchivePath -DestinationPath (Split-Path -Parent $ServerRoot) -Force
}

function Initialize-DataDirectory {
  if (Test-Path -LiteralPath (Join-Path $DataRoot 'mysql')) { return }
  New-Item -ItemType Directory -Path $DataRoot -Force | Out-Null
  & (Join-Path $BinRoot 'mariadb-install-db.exe') --datadir=$DataRoot --password=$RootPassword --port=$Port
  if ($LASTEXITCODE -ne 0) { throw 'No fue posible inicializar el directorio de datos de MariaDB.' }
}

function Start-MariaDb {
  Install-MariaDbPortable
  Initialize-DataDirectory
  if (-not (Test-MariaDbReady)) {
    $server = Join-Path $BinRoot 'mariadbd.exe'
    Start-Process -FilePath $server -ArgumentList @(
      "--defaults-file=$ConfigPath",
      "--pid-file=$PidFile",
      "--log-error=$LogFile"
    ) -WindowStyle Hidden | Out-Null
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
      Start-Sleep -Milliseconds 500
      if (Test-MariaDbReady) { $ready = $true; break }
    }
    if (-not $ready) {
      Get-Content -LiteralPath $LogFile -Tail 30 -ErrorAction SilentlyContinue
      throw 'MariaDB no pudo iniciar. Revisa el puerto configurado y el archivo .runtime/mariadb.log.'
    }
  }

  $client = Join-Path $BinRoot 'mariadb.exe'
  $schema = (Join-Path $ProjectRoot 'database\schema.sql').Replace('\', '/')
  $seed = (Join-Path $ProjectRoot 'database\seed.sql').Replace('\', '/')
  & $client --host=127.0.0.1 --port=$Port --user=root "--password=$RootPassword" "--execute=source $schema"
  if ($LASTEXITCODE -ne 0) { throw 'No fue posible aplicar database/schema.sql.' }
  $migrationsRoot = Join-Path $ProjectRoot 'database\migrations'
  if (Test-Path -LiteralPath $migrationsRoot) {
    foreach ($migration in Get-ChildItem -LiteralPath $migrationsRoot -Filter '*.sql' | Sort-Object Name) {
      $migrationPath = $migration.FullName.Replace('\', '/')
      & $client --host=127.0.0.1 --port=$Port --user=root "--password=$RootPassword" "--execute=source $migrationPath"
      if ($LASTEXITCODE -ne 0) { throw "No fue posible aplicar la migración $($migration.Name)." }
    }
  }
  $safeDatabase = $DatabaseName.Replace('`', '``')
  $safeUser = $DatabaseUser.Replace("'", "''")
  $safePassword = $DatabasePassword.Replace("'", "''")
  $grant = @"
CREATE USER IF NOT EXISTS '$safeUser'@'%' IDENTIFIED BY '$safePassword';
CREATE USER IF NOT EXISTS '$safeUser'@'localhost' IDENTIFIED BY '$safePassword';
CREATE USER IF NOT EXISTS '$safeUser'@'127.0.0.1' IDENTIFIED BY '$safePassword';
ALTER USER '$safeUser'@'%' IDENTIFIED BY '$safePassword';
ALTER USER '$safeUser'@'localhost' IDENTIFIED BY '$safePassword';
ALTER USER '$safeUser'@'127.0.0.1' IDENTIFIED BY '$safePassword';
GRANT ALL PRIVILEGES ON ``$safeDatabase``.* TO '$safeUser'@'%';
GRANT ALL PRIVILEGES ON ``$safeDatabase``.* TO '$safeUser'@'localhost';
GRANT ALL PRIVILEGES ON ``$safeDatabase``.* TO '$safeUser'@'127.0.0.1';
FLUSH PRIVILEGES;
"@
  & $client --host=127.0.0.1 --port=$Port --user=root "--password=$RootPassword" "--execute=$grant"
  if ($LASTEXITCODE -ne 0) { throw 'No fue posible crear el usuario de la aplicación.' }
  & $client --host=127.0.0.1 --port=$Port --user=root "--password=$RootPassword" "--execute=source $seed"
  if ($LASTEXITCODE -ne 0) { throw 'No fue posible cargar database/seed.sql.' }
  Write-Host "MariaDB $Version está disponible en 127.0.0.1:$Port."
}

function Stop-MariaDb {
  if (-not (Test-MariaDbReady)) { Write-Host 'MariaDB ya está detenido.'; return }
  & (Join-Path $BinRoot 'mariadb-admin.exe') --host=127.0.0.1 --port=$Port --user=root "--password=$RootPassword" shutdown
  if ($LASTEXITCODE -ne 0) { throw 'No fue posible detener MariaDB.' }
  Write-Host 'MariaDB detenido correctamente.'
}

switch ($Action) {
  'install' { Start-MariaDb }
  'start' { Start-MariaDb }
  'stop' { Stop-MariaDb }
  'status' {
    if (Test-MariaDbReady) { Write-Host "MariaDB está activo en 127.0.0.1:$Port."; exit 0 }
    Write-Host 'MariaDB está detenido.'
    exit 1
  }
  'console' {
    Start-MariaDb
    & (Join-Path $BinRoot 'mariadb.exe') --host=127.0.0.1 --port=$Port --user=$DatabaseUser "--password=$DatabasePassword" "--database=$DatabaseName"
  }
  'tables' {
    Start-MariaDb
    & (Join-Path $BinRoot 'mariadb.exe') --host=127.0.0.1 --port=$Port --user=$DatabaseUser "--password=$DatabasePassword" "--database=$DatabaseName" --table --execute="SHOW TABLES;"
  }
}
