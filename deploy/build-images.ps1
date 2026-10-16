<#
.SYNOPSIS
  Baut die Docker-Images für API und Web-App (Closed Beta).

.DESCRIPTION
  Prüft zuerst den Code (npm run check, abschaltbar mit -SkipCheck) und baut dann
  athletept-api und athletept-web für linux/amd64. Jedes Image bekommt den Tag (Standard: kurzer
  Git-Hash, mit "-dirty" bei uncommitteten Änderungen) und zusätzlich "latest".

  Danach wahlweise:
    -Push   Images in eine Registry schieben (dann -Registry angeben)
    -Save   Images als komprimiertes Archiv nach deploy/out speichern, zum Kopieren auf den
            Server ohne Registry (dort: docker load -i <datei>)

.EXAMPLE
  .\deploy\build-images.ps1
  .\deploy\build-images.ps1 -Save
  .\deploy\build-images.ps1 -Registry registry.example.de/athletept -Push
  .\deploy\build-images.ps1 -Tag beta-1 -SkipCheck
#>
[CmdletBinding()]
param(
  [string]$Tag,
  [string]$Registry = "",
  [string]$Platform = "linux/amd64",
  [switch]$Push,
  [switch]$Save,
  [switch]$SkipCheck
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Invoke-Native {
  param([string]$Description, [scriptblock]$Command)
  Write-Host "==> $Description" -ForegroundColor Cyan
  # Docker und npm schreiben Fortschritt auf stderr. Windows PowerShell 5.1 macht daraus bei
  # "Stop" Fehler, sobald die Ausgabe umgeleitet wird. Maßgeblich ist nur der Exit-Code.
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try { & $Command 2>&1 | ForEach-Object { "$_" } }
  finally { $ErrorActionPreference = $previous }
  if ($LASTEXITCODE -ne 0) {
    throw "Fehlgeschlagen: $Description (Exit-Code $LASTEXITCODE)"
  }
}

# ---- Voraussetzungen ----
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker ist nicht installiert oder nicht im PATH."
}
$ErrorActionPreference = "Continue"
docker info --format "{{.ServerVersion}}" *> $null
$ErrorActionPreference = "Stop"
if ($LASTEXITCODE -ne 0) {
  throw "Docker läuft nicht. Bitte Docker Desktop starten."
}
if ($Push -and -not $Registry) {
  throw "-Push braucht -Registry (z. B. registry.example.de/athletept)."
}

if (-not $Tag) {
  $Tag = (git rev-parse --short HEAD).Trim()
  if ($LASTEXITCODE -ne 0) { throw "Git-Hash nicht ermittelbar. Bitte -Tag angeben." }
  if (git status --porcelain) { $Tag = "$Tag-dirty" }
}

$prefix = ""
if ($Registry) { $prefix = $Registry.TrimEnd("/") + "/" }
$images = @(
  @{ Name = "athletept-api"; Dockerfile = "Dockerfile.api" },
  @{ Name = "athletept-web"; Dockerfile = "Dockerfile.web" }
)

# ---- Prüfen ----
if (-not $SkipCheck) {
  Invoke-Native "Code prüfen (npm run check)" { npm run check }
}

# ---- Bauen ----
$built = @()
foreach ($image in $images) {
  $versioned = "$prefix$($image.Name):$Tag"
  $latest = "$prefix$($image.Name):latest"
  Invoke-Native "Baue $versioned" {
    docker build --platform $Platform -f $image.Dockerfile -t $versioned -t $latest .
  }
  $built += $versioned, $latest
}

# ---- Verteilen ----
if ($Push) {
  foreach ($name in $built) {
    Invoke-Native "Push $name" { docker push $name }
  }
}

if ($Save) {
  $outDir = Join-Path $PSScriptRoot "out"
  New-Item -ItemType Directory -Force $outDir | Out-Null
  $tar = Join-Path $outDir "athletept-images-$Tag.tar"
  Invoke-Native "Speichere Images nach $tar" { docker save -o $tar @built }

  # gzip spart etwa zwei Drittel; docker load liest .tar.gz direkt.
  $gz = "$tar.gz"
  $in = [System.IO.File]::OpenRead($tar)
  $out = [System.IO.File]::Create($gz)
  $zip = New-Object System.IO.Compression.GZipStream($out, [System.IO.Compression.CompressionMode]::Compress)
  try { $in.CopyTo($zip) } finally { $zip.Dispose(); $out.Dispose(); $in.Dispose() }
  Remove-Item $tar
  Write-Host "Archiv: $gz" -ForegroundColor Green
}

# ---- Zusammenfassung ----
Write-Host ""
Write-Host "Fertig. Images:" -ForegroundColor Green
$built | ForEach-Object { Write-Host "  $_" }
Write-Host ""
Write-Host "Auf dem Server (Ordner mit docker-compose.app.yml und .env):"
if ($Save) {
  Write-Host "  docker load -i athletept-images-$Tag.tar.gz"
}
elseif ($Push) {
  Write-Host "  docker compose -f docker-compose.app.yml pull"
}
Write-Host "  In .env: API_IMAGE=$($prefix)athletept-api:$Tag"
Write-Host "           WEB_IMAGE=$($prefix)athletept-web:$Tag"
Write-Host "  docker compose -f docker-compose.app.yml up -d"
