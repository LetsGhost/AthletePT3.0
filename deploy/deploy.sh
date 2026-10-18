#!/usr/bin/env bash
# Tauscht auf dem Server die Container von API und/oder Web-App gegen ein neues Image aus.
# Läuft im Ordner mit docker-compose.app.yml und .env. Gegenstück zu build-images.sh.
#
# Ablauf je Dienst: laufendes Image als athletept-<dienst>:previous sichern, neues Image als
# athletept-<dienst>:latest setzen, Container neu starten, auf den Docker-Healthcheck warten.
# Wird er nicht "healthy", startet das Skript automatisch wieder das vorherige Image.
# Wurde web ausgerollt, startet es danach den nginx-Proxy (athletept3-proxy) neu.
#
# Aufruf:
#   ./deploy.sh --name api                       # athletept-api:latest ausrollen
#   ./deploy.sh --name web:3f2a1c9               # bestimmten Tag ausrollen (wird zu latest)
#   ./deploy.sh --name api --name web            # beide nacheinander
#   ./deploy.sh --load athletept-images-3f2a1c9.tar.gz --name api --name web
#
# Optionen:
#   --name <dienst>[:tag]  api oder web, mehrfach erlaubt; ohne Tag wird latest genommen
#   --load <archiv>        vorher docker load -i <archiv> (aus build-images.sh --save)
#   --timeout <sekunden>   max. Wartezeit auf "healthy" je Dienst (Standard: 120)

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir"

compose_file="docker-compose.app.yml"
timeout=120
archive=""
names=()

fail() { echo "Fehler: $*" >&2; exit 1; }
step() { printf '\033[36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[33mWarnung: %s\033[0m\n' "$*" >&2; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name) names+=("${2:?--name braucht einen Wert (api oder web)}"); shift ;;
    --load) archive="${2:?--load braucht einen Dateipfad}"; shift ;;
    --timeout) timeout="${2:?--timeout braucht einen Wert}"; shift ;;
    -h | --help) sed -n '2,20p' "$script_dir/$(basename "$0")" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) fail "Unbekanntes Argument: $1 (siehe --help)" ;;
  esac
  shift
done
[[ ${#names[@]} -eq 0 ]] && fail "Mindestens ein --name angeben (api oder web)."
[[ "$timeout" =~ ^[0-9]+$ ]] || fail "--timeout muss eine Zahl in Sekunden sein."

# Alle Angaben vor dem ersten Neustart prüfen, damit nicht ein Dienst halb ausgerollt wird.
services=()
sources=()
for entry in "${names[@]}"; do
  service="${entry%%:*}"
  tag="latest"
  [[ "$entry" == *:* ]] && tag="${entry#*:}"
  [[ "$service" == api || "$service" == web ]] || fail "Unbekannter Dienst \"$service\" (erlaubt: api, web)."
  [[ -n "$tag" ]] || fail "Leerer Tag in \"$entry\"."
  services+=("$service")
  sources+=("athletept-$service:$tag")
done

# ---- Voraussetzungen ----
command -v docker > /dev/null || fail "Docker ist nicht installiert oder nicht im PATH."
docker info > /dev/null 2>&1 || fail "Docker-Daemon nicht erreichbar (sudo systemctl status docker)."
[[ -f "$compose_file" ]] || fail "$compose_file nicht gefunden in $script_dir."
[[ -f .env ]] || fail ".env nicht gefunden in $script_dir (Vorlage: .env.example)."

if [[ -n "$archive" ]]; then
  [[ -f "$archive" ]] || fail "Archiv nicht gefunden: $archive"
  step "Lade Images aus $archive"
  docker load -i "$archive"
fi

for source in "${sources[@]}"; do
  docker image inspect "$source" > /dev/null 2>&1 \
    || fail "Image $source nicht vorhanden (docker load oder docker pull vergessen?)."
done

compose() { docker compose -f "$compose_file" "$@"; }

# Compose liest API_IMAGE/WEB_IMAGE aus der .env. Das Skript arbeitet immer mit :latest und
# setzt die Variablen deshalb selbst (Shell-Variablen gehen der .env vor).
export API_IMAGE="athletept-api:latest" WEB_IMAGE="athletept-web:latest"
for var in API_IMAGE WEB_IMAGE; do
  configured="$(sed -n "s/^$var=//p" .env | tail -n1)"
  if [[ -n "$configured" && "$configured" != "${!var}" ]]; then
    warn "In .env steht $var=$configured. Das Skript nutzt ${!var}; ein manuelles 'docker compose up' würde wieder $configured starten."
  fi
done

# Wartet, bis der Healthcheck des Containers "healthy" meldet. Rückgabe 1 bei "unhealthy",
# beendetem Container oder Zeitüberschreitung.
wait_healthy() {
  local container="$1" waited=0 status
  while (( waited < timeout )); do
    status="$(docker inspect --format '{{.State.Status}}/{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$container" 2> /dev/null || echo "missing/")"
    case "$status" in
      running/healthy) return 0 ;;
      running/unhealthy | exited/* | dead/* | missing/*) echo "  Status: $status" >&2; return 1 ;;
    esac
    sleep 3
    (( waited += 3 ))
    printf '  warte auf %s (%ss, %s)\r' "$container" "$waited" "$status"
  done
  echo >&2
  echo "  Zeitüberschreitung nach ${timeout}s (Status: $status)" >&2
  return 1
}

# ---- Ausrollen ----
deployed=()
for i in "${!services[@]}"; do
  service="${services[$i]}"
  source="${sources[$i]}"
  container="athletept3-$service"
  latest="athletept-$service:latest"
  previous="athletept-$service:previous"

  # Das laufende Image über den Container ermitteln, nicht über den Tag: docker load hat
  # :latest womöglich schon überschrieben.
  previous_id="$(docker inspect --format '{{.Image}}' "$container" 2> /dev/null || true)"
  new_id="$(docker image inspect --format '{{.Id}}' "$source")"

  if [[ -n "$previous_id" && "$previous_id" == "$new_id" ]]; then
    step "$service: läuft bereits mit $source, nichts zu tun"
    continue
  fi

  if [[ -n "$previous_id" ]]; then
    docker tag "$previous_id" "$previous"
  else
    warn "$container läuft nicht. Ohne vorheriges Image ist kein Rollback möglich."
  fi

  step "$service: starte $source"
  [[ "$source" != "$latest" ]] && docker tag "$source" "$latest"
  compose up -d --no-deps "$service"

  if wait_healthy "$container"; then
    printf '\033[32m  %s ist healthy.\033[0m\n' "$service"
    deployed+=("$service")
    continue
  fi

  echo "  Letzte Logs von $container:" >&2
  docker logs --tail 40 "$container" 2>&1 | sed 's/^/    /' >&2 || true

  if [[ -z "$previous_id" ]]; then
    fail "$service ist nicht healthy, und es gibt kein vorheriges Image für einen Rollback."
  fi

  step "$service: Rollback auf $previous"
  docker tag "$previous" "$latest"
  compose up -d --no-deps "$service"
  if wait_healthy "$container"; then
    fail "$service: neues Image fehlerhaft, vorherige Version läuft wieder. Abbruch.${deployed[*]:+ Bereits ausgerollt: ${deployed[*]}}"
  fi
  fail "$service: auch der Rollback ist nicht healthy. Bitte sofort prüfen: docker logs $container"
done

# ---- nginx-Proxy neu starten ----
# Nach einem neuen Web-Container den Proxy (docker-compose.proxy.yml) neu starten, damit er
# sicher keine alten Verbindungen oder Antworten zum vorherigen Container mehr hält.
proxy_container="athletept3-proxy"
if [[ " ${deployed[*]} " == *" web "* ]]; then
  if docker inspect "$proxy_container" > /dev/null 2>&1; then
    step "proxy: starte $proxy_container neu"
    docker restart "$proxy_container" > /dev/null
    if [[ "$(docker inspect --format '{{.State.Status}}' "$proxy_container")" == running ]]; then
      printf '\033[32m  %s läuft wieder.\033[0m\n' "$proxy_container"
    else
      warn "$proxy_container läuft nach dem Neustart nicht. Bitte prüfen: docker logs $proxy_container"
    fi
  else
    warn "$proxy_container nicht gefunden, Proxy wurde nicht neu gestartet."
  fi
fi

# ---- Zusammenfassung ----
echo
printf '\033[32mFertig.\033[0m Ausgerollt: %s\n' "${deployed[*]:-nichts}"
echo "Rollback von Hand: docker tag athletept-<dienst>:previous athletept-<dienst>:latest"
echo "                   docker compose -f $compose_file up -d --no-deps <dienst>"
