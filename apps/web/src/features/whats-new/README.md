# „Was ist neu?“-Dialog

Zeigt Nutzern nach einem Update einmalig, was sich geändert hat: ein Karussell mit einer
Seite pro Neuerung (Vorschaubild, Titel, kurzer Text).

**Für einen neuen Eintrag musst du nur `release-notes.tsx` bearbeiten.**

## So verhält sich der Dialog

- Er öffnet sich **von selbst**, sobald es ein Release gibt, das der Nutzer noch nicht
  gesehen hat. Nicht auf `/workouts/…` (laufendes Training), dann erst auf der nächsten Seite.
- **Egal wie er geschlossen wird** („Später“, „Los geht’s“, X, Escape, Klick daneben): Die App
  setzt in `localStorage` unter `atp-whats-new` das Flag `{ "release": "<id>", "dismissed": true }`
  und zeigt ihn erst wieder von selbst, wenn ein Release mit **neuer** `id` erscheint.
- Das Flag gilt pro Gerät/Browser, nicht pro Konto: Nach einem Kontowechsel erscheint er nicht
  erneut. Auf einem neuen Gerät oder nach dem Löschen der Browserdaten sieht man ihn einmal erneut.
- Es zählt immer nur das **neueste** Release, das für die Rolle Einträge hat. Wer zwei
  Releases verpasst hat, sieht nur das letzte.
- Wieder aufrufen: Kontomenü → **„Was ist neu?“**. Auf der Athleten-Übersicht gibt es
  zusätzlich 30 Tage lang den Chip **„Neu in Version …“**.

## Dateien

| Datei                   | Wofür                                                      |
| ----------------------- | ---------------------------------------------------------- |
| `release-notes.tsx`     | **Die Inhalte.** Hier kommen neue Releases rein.           |
| `preview-kit.tsx`       | Bausteine für die Vorschaubilder                           |
| `types.ts`              | Aufbau eines Releases / einer Neuerung                     |
| `whats-new-dialog.tsx`  | Der Dialog, die Logik „wann öffnen“ und der Übersicht-Chip |
| `store.ts`              | „Gesehen“ speichern, manuelles Öffnen                      |
| `whats-new.test.tsx`    | Tests, prüft auch die Inhalte in `release-notes.tsx`       |

## Neues Release anlegen: Schritt für Schritt

### 1. Release oben in die Liste einfügen

In `release-notes.tsx` **ganz oben** in `releaseNotes` (neueste zuerst):

```tsx
export const releaseNotes: WhatsNewRelease[] = [
  {
    id: "3.2",              // eindeutig, nach dem Ausrollen NIE mehr ändern
    version: "3.2",         // erscheint als „Neu in Version 3.2“
    date: "2026-11-05",     // Erscheinungsdatum, steuert den 30-Tage-Chip
    roles: ["athlete"],     // optional: nur für diese Rollen (sonst alle)
    items: [
      // eine Seite pro Neuerung, siehe Schritt 2
    ],
  },
  {
    id: "3.1",
    // … das bisherige Release bleibt unverändert darunter stehen
  },
];
```

Wichtig zur `id`:

- Eine **neue** `id` heißt: Alle Nutzer sehen den Dialog wieder.
- Die `id` eines ausgerollten Releases ändern heißt: Alle sehen es **noch einmal**. Für
  Tippfehler im Text also nur `title`/`text` korrigieren, die `id` bleibt.
- Rollen: `"athlete"`, `"coach"`, `"sysadmin"`.

### 2. Neuerungen eintragen

Jede Neuerung ist eine Seite im Karussell. 3–5 Seiten sind ideal, mehr liest niemand.

```tsx
import { CalendarCheck } from "lucide-react";

{
  title: "Wochenplan teilen",                       // kurz, max. ~35 Zeichen
  text: "Schick deinem Coach deinen Wochenplan mit einem Tipp. Er sieht sofort, wann du trainierst.",
  icon: CalendarCheck,                               // Lucide-Icon
  tone: "accent",                                    // optional: "accent" (Standard) oder "records" (Gold)
  roles: ["coach"],                                  // optional: nur diese Rolle sieht die Seite
  permissions: ["ownPlan"],                          // optional: nur Athleten mit dieser Freigabe
  preview: ( /* optional, siehe Schritt 3 */ ),
},
```

Texte:

- In **Du-Form**, so wie der Rest der App.
- Erklären, **was der Nutzer davon hat**, nicht was technisch geändert wurde.
- Ein bis zwei Sätze, damit die Höhe des Dialogs nicht springt.

Icons: alle aus [lucide.dev/icons](https://lucide.dev/icons), Import aus `lucide-react`.

### 3. Vorschaubild bauen

Du hast drei Möglichkeiten, von schnell nach aufwendig:

#### a) Gar keine Vorschau: nur Icon

`preview` weglassen. Der Dialog zeigt dann das `icon` groß und leuchtend in der Farbe von
`tone`. Für kleinere Neuerungen völlig ausreichend.

#### b) Mini-Oberfläche aus Bausteinen (empfohlen)

Aus den Bausteinen in `preview-kit.tsx` eine vereinfachte Version der neuen Funktion
zusammensetzen. Sieht im hellen und dunklen Design richtig aus, ohne dass du Farben angibst.

```tsx
preview: (
  <PreviewStack>
    <PreviewInput label="Name" value="Butterfly" focused />
    <PreviewStepper label="Sätze" value={3} />
    <PreviewButton>Übung hinzufügen</PreviewButton>
  </PreviewStack>
),
```

Die Vorschaufläche ist etwa **184 px hoch**. Mehr als 3–4 Bausteine untereinander passen
nicht; was überläuft, wird abgeschnitten. Prüfe das Ergebnis im Browser (Schritt 4).

#### c) Screenshot oder Grafik

Bild in `src/features/whats-new/images/` ablegen (z. B. `3.2-wochenplan.webp`) und
importieren:

```tsx
import wochenplan from "./images/3.2-wochenplan.webp";

preview: <PreviewImage src={wochenplan} />,
```

- Nicht in `public/` legen: Die Bilder sollen mit dem App-Code gebündelt und gecacht werden.
- Format WebP, Breite ca. 800 px, möglichst unter 60 kB. Das Bild wird eingepasst
  (`object-contain`), Seitenverhältnis ca. 2 : 1 nutzt die Fläche am besten.
- Screenshots zeigen nur ein Farbschema. Wenn möglich lieber Variante b).

### 4. Ansehen und prüfen

1. `npm run dev` starten und anmelden.
2. Der Dialog sollte von selbst aufgehen. Falls du ihn schon geschlossen hast: Kontomenü →
   „Was ist neu?“, oder in den DevTools unter _Application → Local Storage_ den Eintrag
   `atp-whats-new` löschen und neu laden.
3. Alle Seiten durchblättern, **hell und dunkel** (Einstellungen → Farbschema) und in
   **Handybreite** (DevTools → Gerätemodus) ansehen.
4. `npm run check` im Projektordner. Der Test prüft auch `release-notes.tsx`: eindeutige
   IDs, gültige Daten, neueste zuerst, keine doppelten Titel.

## Baustein-Übersicht (`preview-kit.tsx`)

**Anordnung**

| Baustein                            | Wofür                                                         |
| ----------------------------------- | ------------------------------------------------------------- |
| `PreviewStack`                      | Untereinander. `center` zentriert.                            |
| `PreviewGrid columns={2\|3\|4}`     | Nebeneinander, gleich breit                                   |
| `PreviewRow variant=…`              | Nebeneinander in einer Zeile. `"box"` mit Hintergrund, `"highlight"` türkis eingefärbt, ohne nur Anordnung |
| `PreviewCard tone=…`                | Karte mit Rahmen. `tone`: `"primary"`, `"accent"`, `"records"` |
| `PreviewTextGroup`                  | Mehrere Texte untereinander (Titel + Untertitel). `grow`, `align="right"` |

**Inhalte**

| Baustein                               | Wofür                                                      |
| -------------------------------------- | ---------------------------------------------------------- |
| `PreviewText size=… muted tone grow`   | Text. Größen `sm`, `md`, `lg`, `xl` (große Zahl)           |
| `PreviewNumber`                        | Runde Nummer, z. B. Satznummer                             |
| `PreviewCheck`                         | Abgehakter Haken-Button                                    |
| `PreviewChip`                          | Kleiner Knopf mit Rahmen („+15“)                           |
| `PreviewButton variant=…`              | Button: `"primary"`, `"outline"`, `"dashed"`               |
| `PreviewInput label value focused`     | Eingabefeld, optional mit Fokus und Cursor                 |
| `PreviewStepper label value`           | Zahl mit − und +                                           |
| `PreviewProgress value={0.7}`          | Fortschrittsbalken (0 bis 1)                               |
| `PreviewIcon icon tone size`           | Großes leuchtendes Icon                                    |
| `PreviewTile filled`                   | Platzhalter-Kachel                                         |
| `PreviewWeek days`                     | Woche Mo–So als Punkte (`"done"`, `"next"`, `"free"`)      |
| `PreviewThumb src`                     | Kleines quadratisches Bild, z. B. Muskelbild eines Tags    |
| `PreviewImage src`                     | Screenshot oder Grafik                                     |

Ein vollständiges Beispiel mit Zeile, Karte und Fortschritt ist der Pausentimer in
`release-notes.tsx` (Release 3.1).

**Neuer Baustein nötig?** In `preview-kit.tsx` ergänzen, nicht direkt im Release:

- Nur Design-Tokens verwenden (`bg-surface`, `text-muted`, `bg-primary`, `text-accent`,
  `border-border`, …), keine festen Farbwerte, sonst passt es im hellen Design nicht.
- Keine echten Buttons oder Links: Die Vorschau ist Deko und für Screenreader ausgeblendet
  (`aria-hidden`). Klickbares würde sonst Tastatur-Fokus bekommen, ohne etwas zu tun.

## Häufige Fragen

**Der Dialog geht in Tests nicht auf?**
Absicht. `src/test/setup.ts` ersetzt `release-notes.tsx` in allen Tests durch eine leere
Liste, damit der Dialog nicht über jeder Seite liegt. Eigene Tests für den Dialog arbeiten
mit Testdaten (`whats-new.test.tsx`).

**Ich will einen Eintrag nur Athleten mit einer Berechtigung zeigen.**
`permissions: ["ownPlan"]` (oder `"ownWeek"`) an die Neuerung. Mehrere müssen alle freigegeben
sein, Coaches und Sysadmin sehen solche Seiten nie. Der Dialog wartet bei Athleten, bis die
Berechtigungen geladen sind. Bleibt für einen Athleten ohne Freigabe keine Seite übrig, sieht er
wie bei Rollen das vorherige Release. Bekommt er die Freigabe später, erscheint das neue Release
automatisch, sofern er es noch nicht weggeklickt hat.

**Ich will einen Eintrag nur Coaches zeigen.**
`roles: ["coach"]` an die Neuerung. Hat ein Release für eine Rolle keine einzige Seite,
sieht diese Rolle das Release gar nicht und bleibt beim vorherigen.

**Ich will den Dialog für ein Release gar nicht automatisch zeigen.**
Dann kein neues Release anlegen, sondern die Neuerung in einem späteren Release mit
aufnehmen.

**Neue Nutzer sehen das neueste Release beim ersten Login.**
Ja, weil sie es noch nicht gesehen haben. Das ist als kurze Einführung gewollt.
