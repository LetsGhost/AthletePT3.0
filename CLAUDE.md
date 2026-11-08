# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Zusammenarbeit (verbindlich)

- **Sprache:** Mit dem Nutzer Deutsch, kurz und direkt. Commit-Messages, Code-Kommentare und UI-Texte auf Deutsch (UI in Du-Form), Bezeichner im Code Englisch.
- **Größere oder unklare Features:** Nicht losbauen. Erst in mehreren Fragerunden (AskUserQuestion, „grill me“) alle Unklarheiten klären: Fachregeln, Rollen/Berechtigungen, Randfälle, Texte. Erst wenn nichts mehr offen ist, umsetzen. Kleine, eindeutige Änderungen direkt machen.
- **Visuelle Features:** Zusätzlich einen fertigen Prompt für Claude Design schreiben (Zweck, Rolle/Nutzer, Screens und Zustände, Inhalte, helles + dunkles Theme, Handybreite, vorhandene Design-Tokens aus `apps/web/src/styles/index.css`), den der Nutzer dort einfügen kann.
- **Neue npm-Abhängigkeiten nur nach Rückfrage.** Vorher prüfen, ob vorhandene Pakete oder eigener Code reichen.
- **Git:** Arbeit auf einem Feature-Branch von `development` (`feature/<name>`), dort committen im Stil der History (`feat(web): …`, `fix: …`, `feat(plans): …`, Deutsch). **Nicht** nach `development` mergen und nichts pushen, außer der Nutzer sagt es. `production` entspricht immer dem, was auf dem Server läuft, nur bei echtem Deploy bewegen.

### Fertig ist eine Aufgabe erst, wenn

1. `npm run check` grün ist (wie die CI).
2. Neue Logik Tests hat (API: Vitest mit In-Memory-MongoDB, Web: Vitest + Testing Library + MSW).
3. Neue Fachregeln/API-Konventionen im `README.md` (Abschnitt „API-Konventionen“ bzw. „Frontend-Konventionen“) ergänzt sind.
4. **Jedes neue Feature in „Was ist neu“ eingetragen ist** (siehe unten).

### „Was ist neu“ – Pflicht für jedes Feature

Alles, was Nutzer sehen oder merken (neue Funktionen, spürbare Verbesserungen), kommt in `apps/web/src/features/whats-new/release-notes.tsx`. Reine Bugfixes, Refactorings und CI nicht.

- **Welches Release:** Ist das oberste Release noch nicht live, kommt die Neuerung dort dazu. Live-Stand prüfen mit `git show production:apps/web/src/features/whats-new/release-notes.tsx | grep -m1 'id: "'`. Ist das oberste Release schon auf `production`, ein neues Release ganz oben anlegen (nächste Version, z. B. 3.5 → 3.6, `date` = heute).
- Die `id` eines ausgerollten Releases nie ändern (sonst sehen alle den Dialog erneut).
- Texte: Du-Form, 1–2 Sätze, Nutzen statt Technik, Titel max. ~35 Zeichen. `roles`/`permissions` setzen, wenn nur bestimmte Nutzer betroffen sind.
- Vorschau bevorzugt aus `preview-kit.tsx`-Bausteinen; neue Bausteine dort ergänzen, nur Design-Tokens.
- Vollständige Anleitung: `apps/web/src/features/whats-new/README.md`. Der Test `whats-new.test.tsx` prüft die Inhalte.

## Befehle

```sh
npm install
npm run dev:demo        # ohne Docker: In-Memory-MongoDB + Demo-Konten (Passwort: demo-passwort), API + Web
npm run dev             # mit Docker: vorher `docker compose -f docker-compose.dev.yml up -d` und apps/api/.env
npm run check           # format:check + lint + typecheck + test (wie CI)
npm run lint:fix && npm run format
npm test                # alle Workspaces
```

Einzelner Test (Vitest, pro Workspace):

```sh
npm test -w @athletept/api -- src/modules/plans/plan.test.ts
npm test -w @athletept/web -- src/features/whats-new/whats-new.test.tsx -t "Testname"
npm test -w @athletept/shared -- src/plan.test.ts
```

Web-App http://localhost:5173, API http://localhost:3000/api/v1, Swagger unter `/api/v1/docs`, Mailpit http://localhost:8025. Demo-Konten: `admin@demo.local`, `coach@demo.local`, `coach2@demo.local`, `athlet@demo.local`, `athletin@demo.local`.

## Architektur

npm-Workspaces-Monorepo, Node ≥ 26, ESM, TypeScript 5.9.

- `packages/shared` (`@athletept/shared`): zod-Schemas, Typen und reine Fachlogik (z. B. `detectPlanType`, Kalender in `Europe/Berlin`, Stats), von API und Web genutzt. Neue Request-/Response-Formen gehören hierher.
- `apps/api`: Express 5, Mongoose, zod. Ein Ordner pro Fachbereich unter `src/modules/<bereich>` (`*.routes.ts`, `*.service.ts`, `*.model.ts`, `*.test.ts`). Router entstehen über `createModuleRouter` (`src/lib/router.ts`): Validierung und OpenAPI-Doku kommen aus denselben zod-Schemas. Neue Router in der `modules`-Liste in `src/app.ts` eintragen. Fehler immer als `application/problem+json` mit stabilem `code` (`AppError` in `src/lib/errors.ts`). Tests laufen gegen eine In-Memory-MongoDB (`test/global-setup.ts`, Helfer in `test/helpers.ts`).
- `apps/web`: React 19, Vite, React Router, TanStack Query, Tailwind, react-hook-form + zod. `src/app` (Router, Guards, Navigation), `src/components/ui` (Bausteine), `src/features/<bereich>` (Logik + Komponenten), `src/pages` (eine Datei pro Route, lazy). Farben nur über Design-Tokens (CSS-Variablen in `src/styles/index.css`, hell + dunkel, WCAG AA). Keine Inline-Skripte/`eval` (CSP).
- Rollen: `sysadmin`, `coach`, `athlete`. Pläne und Protokolle gehören dem Athleten, nicht dem Coach.

Fachregeln, die man nicht brechen darf (Details im README, „API-Konventionen“):
- Ganze Dokumente speichern mit `revision` (409 `plan_conflict`/`workout_conflict` bei Konflikt).
- Feste Listen in `packages/shared/src/exercise.ts`: Schlüssel nie umbenennen, nur ergänzen. Übungen archivieren statt löschen.
- Berechnung der Übungsstatistik geändert → `WORKOUT_STATS_VERSION` (`apps/api/src/modules/stats/exercise-stats.service.ts`) hochsetzen.
- Datenschutzerklärung inhaltlich geändert → `PRIVACY_POLICY_VERSION` (`packages/shared/src/legal.ts`) hochsetzen.

## Deployment

Manuell, nicht an Branches gekoppelt: `.\deploy\build-images.ps1` (führt `npm run check` aus, baut `athletept-api` und `athletept-web`, Tag = Git-Hash), auf dem Server per Docker Compose (`deploy/`). Details im README.
