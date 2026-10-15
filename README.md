# AthletePT 3.0

Coaching-Plattform für Coaches und Athleten: Trainingspläne, Trainingsprotokolle und Fortschritt.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `apps/api` | REST-API: Node 22, Express 5, MongoDB (Mongoose), zod |
| `apps/web` | Web-Frontend: React 19, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS |
| `packages/shared` | zod-Schemas und Typen, die API und Web gemeinsam nutzen |

## Voraussetzungen

- Node.js 22 oder neuer
- Für die normale Entwicklung und das Bauen der Images: Docker. Für den Demo-Modus nicht nötig.

## Schnellstart ohne Docker: Demo-Modus

```sh
npm install
npm run dev:demo
```

Startet eine In-Memory-MongoDB mit Demo-Konten, die API und die Web-App. Nichts muss konfiguriert werden, die Daten sind nach dem Beenden weg.

- Web-App: http://localhost:5173, Passwort für alle Konten: `demo-passwort`
- Konten: `admin@demo.local` (Sysadmin), `coach@demo.local` und `coach2@demo.local` (Coaches), `athlet@demo.local` und `athletin@demo.local` (je ein Athlet pro Coach)
- Mails (Einladungen, Passwort-Reset) erscheinen samt Link im Terminal.

## Lokale Entwicklung (mit Docker)

```sh
npm install
docker compose -f docker-compose.dev.yml up -d      # MongoDB (Replica Set) + Mailpit
cp apps/api/.env.example apps/api/.env             # JWT_SECRET eintragen (mind. 32 Zeichen)
npm run create-sysadmin -w @athletept/api -- --email du@example.com --name "Dein Name"
npm run dev
```

- Web-App: http://localhost:5173 (Vite leitet `/api` an die API weiter)
- **Test-Postfach (Mailpit): http://localhost:8025**. Alle Mails landen hier, nichts geht nach draußen.
- API: http://localhost:3000/api/v1
- API-Doku (Swagger UI): http://localhost:3000/api/v1/docs
- Healthcheck: http://localhost:3000/health

### E-Mails

| Umgebung | `MAIL_TRANSPORT` | Wohin |
|---|---|---|
| Entwicklung mit Docker | `smtp` | Mailpit (http://localhost:8025) |
| Entwicklung ohne Docker / Demo | `console` | Terminal-Log |
| Tests | `memory` | Speicher, wird in den Tests geprüft |
| Produktion | `resend` | Resend (`RESEND_API_KEY`, `MAIL_FROM` mit verifizierter Domain) |

## Skripte (im Root)

| Skript | Zweck |
|---|---|
| `npm run dev` | API und Web-App im Watch-Modus |
| `npm run dev:demo` | Demo-Modus ohne Docker (In-Memory-DB, Demo-Konten) |
| `npm test` | Alle Tests (API-Tests nutzen eine In-Memory-MongoDB) |
| `npm run lint` / `npm run format` | ESLint / Prettier |
| `npm run typecheck` | TypeScript-Prüfung aller Pakete |
| `npm run check` | Alles zusammen, wie in der CI |
| `npm run build` | Produktions-Build |

## API-Konventionen

- Alle Endpunkte liegen unter `/api/v1`.
- **Auth:** `POST /auth/login` liefert ein Access-Token (Bearer, 15 min) und setzt ein httpOnly-Cookie mit dem Refresh-Token (Rotation bei jedem `POST /auth/refresh`, Widerruf bei Logout und Passwortwechsel).
- **Rollen:** `sysadmin` (verwaltet Coaches), `coach` (verwaltet eigene Athleten), `athlete`.
- **Coach sperren:** Hat der Coach Athleten, gehen sie in derselben Transaktion an einen anderen aktiven Coach (`reassignToCoachId`), dessen Kontingent reichen muss.
- **Übungskatalog:** Globale Übungen pflegt der Sysadmin, Coaches sehen sie nur lesend und legen zusätzlich eigene an, die nur sie sehen. Muskelgruppen, Equipment und Kategorien sind feste Listen in `packages/shared/src/exercise.ts` (Schlüssel nie umbenennen, nur ergänzen). Übungen werden archiviert statt gelöscht, weil Pläne auf ihre ID verweisen. Beim Start ergänzt die API fehlende Startübungen (`modules/exercises/exercise-seed.ts`); Änderungen des Sysadmins bleiben dabei erhalten.
- **Trainingspläne:** Pläne gehören dem Athleten (`/athletes/:athleteId/plans`), nicht dem Coach. Bei einem Coach-Wechsel arbeitet der neue Coach mit ihnen weiter. Status: Entwurf → aktiv → archiviert. Pro Athlet ist höchstens ein Plan aktiv, beim Aktivieren wird der bisherige archiviert. Gelöscht werden nur Entwürfe. Vor jeder Änderung eines aktiven Plans sichert die API den bisherigen Stand als Version. Gespeichert wird immer der ganze Plan (`PUT` mit `revision`, sonst 409 `plan_conflict`). Tage und Übungseinträge behalten ihre IDs, Übungsnamen und Plan-Typ (`detectPlanType` in `packages/shared/src/plan.ts`; Ober- und Unterkörper je ≥ 25 % ohne Rumpf ergibt Ganzkörper) setzt der Server. Archivierte Übungen und eigene Übungen eines früheren Coaches bleiben im Plan stehen, lassen sich aber nicht neu einplanen. Athleten lesen ihren aktiven Plan samt Übungsdetails über `GET /me/plan`. Vorlagen (`/plan-templates`) gehören dem Coach, Pläne daraus sind Kopien.
- **Trainingsprotokolle:** Eine Einheit pro Dokument (`WorkoutLog`) mit Status `in_progress` → `completed` oder `skipped`. Athleten starten über `POST /me/workout-logs` ein Training nach einem Tag des aktiven Plans (höchstens eines gleichzeitig, Datum bis 14 Tage zurück). Vorgaben, Übungs- und Tagesnamen werden beim Start kopiert. Gespeichert wird immer das ganze Protokoll (`PUT` mit `revision`, sonst 409 `workout_conflict`). Die Web-App speichert automatisch und puffert ungesendete Änderungen im localStorage. Abgeschlossene Trainings lassen sich 7 Tage lang korrigieren. Coaches sehen nur abgeschlossene und abgesagte Trainings (`/athletes/:athleteId/workout-logs`).
- **Wochenansicht:** `GET /me/week` bzw. `/athletes/:athleteId/week?week=2026-W42` wird aus aktivem Plan und Protokollen der ISO-Woche berechnet, gespeichert wird nichts (kein wöchentlicher Reset). Kalendertage gelten in `Europe/Berlin` (`APP_TIME_ZONE` in `packages/shared/src/calendar.ts`). Der Wochenplan mit Freitexten je Wochentag (z. B. „Laufen“) hängt am Athleten, nicht am Plan (`PUT /athletes/:athleteId/weekly-activities`).
- **Übungsanalyse:** Wird aus abgeschlossenen Protokollen berechnet (`GET /me/exercise-stats`, `/athletes/:athleteId/exercise-stats`). Die Kennzahlen je Übung und Training stehen am Protokoll (`stats`) und werden bei jedem Speichern neu berechnet; Bestwerte und Verlauf entstehen beim Abruf. Bei Änderungen an der Berechnung `WORKOUT_STATS_VERSION` (`modules/stats/exercise-stats.service.ts`) hochsetzen, dann berechnet die API beim Start alle Protokolle neu. Es zählen nur erledigte Arbeitssätze, Zuordnung über die `exerciseId`. Hauptkennzahl ist das geschätzte Maximum nach Epley (bis 12 Wdh.), bei Übungen ohne Gewicht die meisten Wiederholungen bzw. die längste Dauer. Der Verlauf umfasst die letzten 16 Einheiten. Beim Abschließen eines Trainings meldet die API neue Bestwerte (`newRecords`). Diagramme mit Chart.js, die Werte stehen zusätzlich in einer Tabelle.
- **DSGVO-Einwilligung:** Athleten willigen beim Annehmen der Einladung in die Verarbeitung ihrer Gesundheitsdaten ein. Gespeichert werden Zeitpunkt und Version der Datenschutzerklärung (`PRIVACY_POLICY_VERSION` in `packages/shared/src/legal.ts`, bei jeder inhaltlichen Änderung hochsetzen). Der Text unter `/datenschutz` ist ein **Platzhalter und muss rechtlich geprüft werden**.
- **Fehler** kommen immer als `application/problem+json` (RFC 9457) mit stabilem `code`, z. B.:
  ```json
  { "type": "about:blank", "title": "Bad Request", "status": 400, "code": "validation_failed",
    "detail": "Die Anfrage ist ungültig", "errors": [{ "path": "email", "message": "Ungültige E-Mail-Adresse" }] }
  ```
- Request-Schemas, Validierung und OpenAPI-Doku entstehen aus denselben zod-Schemas (`createModuleRouter` in `apps/api/src/lib/router.ts`).

## Konfiguration

Alle Variablen stehen mit Erklärung in [`apps/api/.env.example`](apps/api/.env.example). Die API prüft sie beim Start und startet nicht, wenn etwas fehlt oder unsicher ist (z. B. ein zu kurzes `JWT_SECRET`). Ohne `NODE_ENV` gilt `production`.

## Deployment (Closed Beta)

Zwei Images, davor ein nginx-Proxy als Container:

| Image | Inhalt | Port (nur im Docker-Netz) |
|---|---|---|
| `athletept-api` (`Dockerfile.api`) | REST-API | 3000 |
| `athletept-web` (`Dockerfile.web`) | Gebaute Web-App in einem schlanken nginx (unprivilegiert), nur statische Dateien | 8080 |

Der Proxy terminiert TLS und leitet `/api/` an die API, alles andere an den Web-Container. Web-App und API liegen damit unter derselben Domain: kein CORS, das Refresh-Cookie (`Secure`, `SameSite=Strict`) funktioniert. HTTPS ist Pflicht.

Auf dem Server gibt es drei Compose-Dateien mit eigenem Lebenszyklus, verbunden über das externe Netz `athletept-proxy`:

| Datei | Dienste |
|---|---|
| `deploy/docker-compose.app.yml` | api, web, mongo |
| `deploy/docker-compose.proxy.yml` | nginx-Proxy (Ports 80/443), lädt sich alle 6 h neu |
| `deploy/docker-compose.certbot.yml` | certbot (Erneuerung alle 12 h per Webroot), `certbot-init` fürs erste Zertifikat |

**Bauen** (Windows, PowerShell, im Repo-Root):

```powershell
.\deploy\build-images.ps1          # prüft (npm run check) und baut, Tag = Git-Hash
.\deploy\build-images.ps1 -Save    # zusätzlich Archiv nach deploy/out zum Kopieren auf den Server
.\deploy\build-images.ps1 -Registry registry.example.de/athletept -Push
```

**Auf dem Server** (Inhalt von `deploy/`), erstmalig:

```sh
docker load -i athletept-images-<tag>.tar.gz     # nur bei -Save
cp .env.example .env                              # ausfüllen: Images, DOMAIN, CERTBOT_EMAIL, MONGO_PASSWORD, ...
cp mongo.env.example mongo.env                    # Root-Passwort für MongoDB
docker network create athletept-proxy
docker compose -f docker-compose.app.yml up -d
docker compose -f docker-compose.certbot.yml run --rm --service-ports certbot-init   # Port 80 muss frei sein
docker compose -f docker-compose.proxy.yml up -d
docker compose -f docker-compose.certbot.yml up -d
docker exec -it athletept3-api node dist/scripts/create-sysadmin.js --email du@example.com --name "Dein Name"
```

Neue Version: Images laden, Tags in `.env` setzen, `docker compose -f docker-compose.app.yml up -d`. Proxy und certbot laufen weiter.

- `deploy/.env.example`: alle Werte für den Betrieb (u. a. `TRUST_PROXY=1`, `APP_URL` mit https, Resend, `DOMAIN`).
- `deploy/nginx/proxy.conf.template`: Konfiguration des Proxys (TLS, Routing, HSTS, ACME-Prüfung). `${DOMAIN}` setzt das nginx-Image beim Start ein. Zertifikate liegen in `deploy/certbot/` (nicht im Git).
- `deploy/nginx/web.conf`: nginx im Web-Container (SPA-Fallback, Caching: Assets 1 Jahr, `index.html` nie, gzip). Sicherheits-Header inkl. CSP in `security-headers.conf`. Die Web-App kommt ohne Inline-Skripte und ohne `eval` aus (`apps/web/src/zod-config.ts`).
- Ohne `SYSADMIN_PASSWORD` erzeugt `create-sysadmin` ein Passwort und gibt es einmalig aus.

### MongoDB-Zugangsdaten

MongoDB läuft in Produktion mit Authentifizierung, die API startet dort ohne Zugangsdaten nicht. Es gibt zwei Konten:

| Konto | Wo | Rechte |
|---|---|---|
| Root (`MONGO_INITDB_ROOT_*`) | `deploy/mongo.env`, nur der mongo-Container sieht es | alles, nur für Wartung |
| API (`MONGO_USER`/`MONGO_PASSWORD`) | `deploy/.env` | `readWrite` auf `athletept` |

Beim ersten Start mit leerem Volume legt MongoDB beide an (`deploy/mongo-init/create-app-user.js`). Den Keyfile, den ein Replica Set mit Authentifizierung braucht, erzeugt der Container bei jedem Start selbst (ein Mitglied, nichts zu speichern).

**Bestehende Datenbank ohne Zugangsdaten umstellen** (das Init-Skript läuft nur bei leerem Volume): `mongo.env` und `MONGO_USER`/`MONGO_PASSWORD`/`MONGO_AUTH_SOURCE` in `.env` anlegen, dann:

```sh
docker compose -f docker-compose.app.yml up -d mongo      # startet jetzt mit Authentifizierung
# Ohne vorhandene Konten erlaubt MongoDB lokal im Container genau das Anlegen des ersten:
docker exec athletept3-mongo sh -c 'mongosh --quiet admin --eval "db.createUser({ user: process.env.MONGO_INITDB_ROOT_USERNAME, pwd: process.env.MONGO_INITDB_ROOT_PASSWORD, roles: [\"root\"] })"'
docker exec athletept3-mongo sh -c 'mongosh --quiet -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin /docker-entrypoint-initdb.d/create-app-user.js'
docker compose -f docker-compose.app.yml up -d            # API mit den neuen Zugangsdaten
```

## Frontend-Konventionen

- **Struktur:** `src/app` (Router, Guards, Navigation), `src/components/ui` (wiederverwendbare Bausteine), `src/components/layout`, `src/features/<bereich>` (Logik und bereichsspezifische Komponenten), `src/pages` (eine Datei pro Route, per Lazy Loading geladen).
- **Design-Tokens** stehen als CSS-Variablen in `src/styles/index.css` (helles und dunkles Theme). Alle Textfarben erfüllen WCAG AA. Athleten starten im dunklen, Coaches im hellen Theme; umstellbar unter Einstellungen.
- **Session:** Das Access-Token liegt nur im Speicher. Beim Start und bei abgelaufenem Token erneuert `refreshSession()` die Sitzung über das httpOnly-Cookie, tab-übergreifend per Web Lock serialisiert.
- **Installierbar (PWA):** `public/manifest.webmanifest` und ein Service Worker (`sw/service-worker.js`, beim Build zu `/sw.js` mit Dateiliste und Version, siehe `vite.config.ts`). Er cacht nur die App selbst, nie API-Antworten; die App startet so auch ohne Netz. Nur im Produktions-Build aktiv. Icons in `public/` sind aus `app-icon.svg` gerendert (maskable mit Rand für Android, `apple-touch-icon.png` für iOS).
- **Formulare:** react-hook-form mit den zod-Schemas aus `@athletept/shared`. Feldfehler der API werden per `applyApiErrors` am Feld angezeigt.
- **Tests:** Vitest + Testing Library + MSW (`src/test`).
