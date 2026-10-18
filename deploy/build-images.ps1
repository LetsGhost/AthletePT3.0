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

  Zum Schluss löscht es ältere athletept-Images (abschaltbar mit -KeepOld). Es bleiben: der neue
  Tag, "latest", "previous" (Rollback von deploy.sh) und alles, was ein Container noch nutzt.

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
  [switch]$SkipCheck,
  [switch]$KeepOld
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

# Wie Invoke-Native, aber still und ohne Abbruch: liefert stdout, Erfolg steht in $LASTEXITCODE.
function Invoke-Quiet {
  param([scriptblock]$Command)
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try { & $Command 2> $null } finally { $ErrorActionPreference = $previous }
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
# Images, deren Tags der neue Build übernimmt. Ohne weiteren Tag wären sie danach namenlos und
# tauchten beim Aufräumen nicht mehr unter ihrem Namen auf.
$replaced = @()
foreach ($image in $images) {
  $versioned = "$prefix$($image.Name):$Tag"
  $latest = "$prefix$($image.Name):latest"
  foreach ($name in $versioned, $latest) {
    $id = Invoke-Quiet { docker image inspect --format "{{.Id}}" $name }
    if ($LASTEXITCODE -eq 0 -and $id) { $replaced += "$id".Trim() }
  }
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

# ---- Aufräumen ----
# Ältere Images löschen. Images, die ein Container nutzt (auch gestoppt), lässt Docker ohnehin
# nicht löschen; sie werden hier gar nicht erst versucht.
if (-not $KeepOld) {
  Write-Host "==> Alte Images löschen" -ForegroundColor Cyan
  $containers = @(Invoke-Quiet { docker ps -aq })
  $inUse = @()
  if ($containers.Count -gt 0) {
    $inUse = @(Invoke-Quiet { docker inspect --format "{{.Image}}" @containers })
  }
  $removed = 0
  foreach ($image in $images) {
    $repo = "$prefix$($image.Name)"
    foreach ($line in @(Invoke-Quiet { docker image ls --no-trunc --format "{{.Tag}} {{.ID}}" $repo })) {
      $imageTag, $imageId = "$line".Trim().Split(" ", 2)
      if ($imageTag -in @($Tag, "latest", "previous") -or $imageId -in $inUse) { continue }
      # Ohne Tag (z. B. alter Stand eines neu vergebenen Tags) nur über die ID löschbar.
      $ref = if ($imageTag -eq "<none>") { $imageId } else { "${repo}:$imageTag" }
      Invoke-Quiet { docker image rm $ref } | Out-Null
      if ($LASTEXITCODE -eq 0) {
        Write-Host "  gelöscht: ${repo}:$imageTag"
        $removed++
      }
      else {
        Write-Host "  übersprungen (noch verwendet): ${repo}:$imageTag"
      }
    }
  }
  # Frühere Stände übernommener Tags. Hat eins noch einen anderen Tag (z. B. previous) oder ist es
  # schon weg, schlägt das Löschen fehl und es bleibt, wie es ist.
  foreach ($id in $replaced) {
    if ($id -in $inUse) { continue }
    Invoke-Quiet { docker image rm $id } | Out-Null
    if ($LASTEXITCODE -eq 0) {
      Write-Host "  gelöscht: früherer Stand $($id.Substring(7, 12))"
      $removed++
    }
  }
  Write-Host "  $removed alte Images gelöscht."
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
