#!/usr/bin/env bash
# Baut die Docker-Images für API und Web-App (Closed Beta). Bash-Gegenstück zu build-images.ps1.
#
# Prüft zuerst den Code (npm run check, abschaltbar mit --skip-check) und baut dann
# athletept-api und/oder athletept-web für linux/amd64. Jedes Image bekommt den Tag (Standard:
# kurzer Git-Hash, mit "-dirty" bei uncommitteten Änderungen) und zusätzlich "latest".
#
# Aufruf:
#   ./deploy/build-images.sh                    # beide Images
#   ./deploy/build-images.sh api                # nur die API
#   ./deploy/build-images.sh web --skip-check   # nur die Web-App, ohne Prüfung
#   ./deploy/build-images.sh --save             # zusätzlich Archiv nach deploy/out
#   ./deploy/build-images.sh --registry registry.example.de/athletept --push
#   ./deploy/build-images.sh --tag beta-1
#
# Optionen:
#   --tag <tag>          Tag statt Git-Hash
#   --registry <prefix>  Registry-Präfix für die Image-Namen
#   --platform <p>       Zielplattform (Standard: linux/amd64)
#   --push               Images in die Registry schieben (braucht --registry)
#   --save               Images als .tar.gz nach deploy/out speichern (Server: docker load -i <datei>)
#   --skip-check         npm run check überspringen

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(dirname "$script_dir")"
cd "$root"

tag=""
registry=""
platform="linux/amd64"
push=false
save=false
skip_check=false
targets=()

fail() { echo "Fehler: $*" >&2; exit 1; }
step() { printf '\033[36m==> %s\033[0m\n' "$*"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    api | web) targets+=("$1") ;;
    --tag) tag="${2:?--tag braucht einen Wert}"; shift ;;
    --registry) registry="${2:?--registry braucht einen Wert}"; shift ;;
    --platform) platform="${2:?--platform braucht einen Wert}"; shift ;;
    --push) push=true ;;
    --save) save=true ;;
    --skip-check) skip_check=true ;;
    -h | --help) sed -n '2,23p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) fail "Unbekanntes Argument: $1 (siehe --help)" ;;
  esac
  shift
done
[[ ${#targets[@]} -eq 0 ]] && targets=(api web)

# ---- Voraussetzungen ----
command -v docker > /dev/null || fail "Docker ist nicht installiert oder nicht im PATH."
if ! docker_error="$(docker info --format '{{.ServerVersion}}' 2>&1 > /dev/null)"; then
  if [[ "$docker_error" == *"permission denied"* ]]; then
    fail "Kein Zugriff auf Docker. Benutzer in die Gruppe docker aufnehmen (sudo usermod -aG docker \$USER) und neu anmelden.
$docker_error"
  fi
  fail "Docker-Daemon nicht erreichbar (läuft er? sudo systemctl status docker).
$docker_error"
fi
if ! $skip_check && ! command -v npm > /dev/null; then
  fail "npm nicht gefunden, wird für npm run check gebraucht. Ohne Prüfung bauen: --skip-check"
fi
if $push && [[ -z "$registry" ]]; then
  fail "--push braucht --registry (z. B. registry.example.de/athletept)."
fi

if [[ -z "$tag" ]]; then
  tag="$(git rev-parse --short HEAD)" || fail "Git-Hash nicht ermittelbar. Bitte --tag angeben."
  [[ -n "$(git status --porcelain)" ]] && tag="$tag-dirty"
fi

prefix=""
[[ -n "$registry" ]] && prefix="${registry%/}/"

# ---- Prüfen ----
if ! $skip_check; then
  step "Code prüfen (npm run check)"
  npm run check
fi

# ---- Bauen ----
built=()
for target in "${targets[@]}"; do
  versioned="${prefix}athletept-$target:$tag"
  latest="${prefix}athletept-$target:latest"
  step "Baue $versioned"
  docker build --platform "$platform" -f "Dockerfile.$target" -t "$versioned" -t "$latest" .
  built+=("$versioned" "$latest")
done

# ---- Verteilen ----
if $push; then
  for name in "${built[@]}"; do
    step "Push $name"
    docker push "$name"
  done
fi

if $save; then
  mkdir -p "$script_dir/out"
  archive="$script_dir/out/athletept-images-$tag.tar.gz"
  step "Speichere Images nach $archive"
  # gzip spart etwa zwei Drittel; docker load liest .tar.gz direkt.
  docker save "${built[@]}" | gzip > "$archive"
  printf '\033[32mArchiv: %s\033[0m\n' "$archive"
fi

# ---- Zusammenfassung ----
echo
printf '\033[32mFertig. Images:\033[0m\n'
printf '  %s\n' "${built[@]}"
echo
echo "Auf dem Server (Ordner mit docker-compose.app.yml und .env):"
if $save; then
  echo "  docker load -i athletept-images-$tag.tar.gz"
elif $push; then
  echo "  docker compose -f docker-compose.app.yml pull"
fi
for target in "${targets[@]}"; do
  echo "  In .env: ${target^^}_IMAGE=${prefix}athletept-$target:$tag"
done
echo "  docker compose -f docker-compose.app.yml up -d"
