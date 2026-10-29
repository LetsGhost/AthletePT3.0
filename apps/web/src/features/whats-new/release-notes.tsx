/**
 * Inhalte des „Was ist neu“-Dialogs. Neueste Version OBEN einfügen.
 * Anleitung: README.md in diesem Ordner.
 */
import {
  Award,
  Bell,
  CalendarCheck,
  CalendarDays,
  Globe,
  History,
  Inbox,
  LayoutGrid,
  ListPlus,
  Plus,
  Replace,
  Shuffle,
  Swords,
  Timer,
  Trophy,
} from "lucide-react";

import upperBody from "@/features/plans/images/upper-body.svg";

import {
  PreviewButton,
  PreviewCard,
  PreviewCheck,
  PreviewChip,
  PreviewGrid,
  PreviewIcon,
  PreviewInput,
  PreviewNumber,
  PreviewProgress,
  PreviewRow,
  PreviewStack,
  PreviewStepper,
  PreviewText,
  PreviewTextGroup,
  PreviewThumb,
  PreviewTile,
  PreviewWeek,
} from "./preview-kit";
import type { WhatsNewRelease } from "./types";

/** Mini-Protokoll für 3.3: letzte Einheit, ein Satz unter der Vorgabe. */
function protocolPreview(name: string) {
  return (
    <PreviewCard tone="accent">
      <PreviewTextGroup>
        <PreviewText size="sm" muted>
          {name}
        </PreviewText>
        <PreviewText>Bankdrücken · 15.10.</PreviewText>
      </PreviewTextGroup>
      <PreviewGrid columns={3}>
        <PreviewRow variant="box">
          <PreviewText>80 kg × 8</PreviewText>
        </PreviewRow>
        <PreviewRow variant="box">
          <PreviewText>80 kg × 8</PreviewText>
        </PreviewRow>
        <PreviewRow variant="box">
          <PreviewText tone="records">80 kg × 5</PreviewText>
        </PreviewRow>
      </PreviewGrid>
    </PreviewCard>
  );
}

export const releaseNotes: WhatsNewRelease[] = [
  {
    id: "3.4",
    version: "3.4",
    date: "2026-10-28",
    items: [
      {
        title: "Challenges sind da",
        text: "Unter Fortschritt (früher Entwicklung) siehst du, wie du in deinen Challenges dastehst. Gezählt wird automatisch aus deinen Trainings.",
        icon: Trophy,
        roles: ["athlete"],
        preview: (
          <PreviewStack>
            <PreviewText size="lg">Challenges</PreviewText>
            <PreviewCard>
              <PreviewRow>
                <PreviewText grow>Team-Volumen Oktober</PreviewText>
                <PreviewText size="sm" muted>
                  31,4 t
                </PreviewText>
              </PreviewRow>
              <PreviewProgress value={0.78} />
              <PreviewText size="sm" tone="records">
                Platz 2 von 6 · Preis: Gratis-Session
              </PreviewText>
            </PreviewCard>
          </PreviewStack>
        ),
      },
      {
        title: "Fordere jemanden heraus",
        text: "Starte ein Duell per E-Mail, über 1, 2 oder 4 Wochen. Wer in der gewählten Wertung vorne liegt, gewinnt. Aufgeben und Revanche inklusive.",
        icon: Swords,
        roles: ["athlete"],
        preview: (
          <PreviewCard tone="accent">
            <PreviewText size="sm" muted>
              Meiste Trainingstage · noch 6 Tage
            </PreviewText>
            <PreviewRow>
              <PreviewText grow>Du</PreviewText>
              <PreviewText size="xl">4 : 3</PreviewText>
              <PreviewText grow align="right">
                Nordlicht
              </PreviewText>
            </PreviewRow>
            <PreviewText size="sm" tone="accent">
              Du führst mit 1 Trainingstag
            </PreviewText>
          </PreviewCard>
        ),
      },
      {
        title: "Globale Challenges",
        text: "Unter Fortschritt → Challenges → Entdecken trittst du System-Challenges bei. In der weltweiten Rangliste erscheinst du nur mit deinem Spitznamen.",
        icon: Globe,
        roles: ["athlete"],
        preview: (
          <PreviewStack>
            <PreviewRow variant="box">
              <PreviewText size="sm" muted>
                1
              </PreviewText>
              <PreviewText grow>IronLena</PreviewText>
              <PreviewText>22</PreviewText>
            </PreviewRow>
            <PreviewRow variant="highlight">
              <PreviewText size="sm" muted>
                87
              </PreviewText>
              <PreviewText grow>Max_M (du)</PreviewText>
              <PreviewText>14</PreviewText>
            </PreviewRow>
            <PreviewButton>Beitreten</PreviewButton>
          </PreviewStack>
        ),
      },
      {
        title: "Abzeichen sammeln",
        text: "Serien, Tonnage, Duellsiege und System-Challenges bringen dir Bronze, Silber oder Gold. Keine Punkte, kein Level, nur echte Leistung.",
        icon: Award,
        tone: "records",
        roles: ["athlete"],
      },
      {
        title: "Benachrichtigungen",
        text: "Die Glocke oben zeigt dir Einladungen, Ergebnisse und wer dich überholt hat. Mails zu Challenges schaltest du in den Einstellungen ab.",
        icon: Bell,
        roles: ["athlete"],
      },
      {
        title: "Anderes Gerät, anderes Gym",
        text: "Markier eine Übung im Training als abweichend. Sie zählt weiter mit, „Letztes Mal“ überspringt sie aber und neue Bestwerte misst du nur an normalen Trainings.",
        icon: Shuffle,
        roles: ["athlete"],
        preview: (
          <PreviewCard>
            <PreviewText>Beinpresse</PreviewText>
            <PreviewRow variant="highlight">
              <PreviewText grow>Abweichend (anderes Gerät/Gym)</PreviewText>
              <PreviewCheck />
            </PreviewRow>
            <PreviewInput label="Notiz" value="Hotel-Gym, andere Maschine" />
          </PreviewCard>
        ),
      },
      {
        title: "Abweichende ausblenden",
        text: "In der Statistik einer Übung blendest du abweichende Trainings mit einem Schalter aus. Bestwerte und Verlauf rechnen dann ohne sie.",
        icon: Shuffle,
        roles: ["athlete"],
      },
      {
        title: "Challenges für dein Team",
        text: "Leg unter Challenges eine Challenge für dein Team an: mit Trainingsdaten oder einer freien Vorgabe wie „100 Klimmzüge am Tag“.",
        icon: Trophy,
        roles: ["coach"],
        preview: (
          <PreviewStack>
            <PreviewGrid columns={3}>
              <PreviewButton variant="outline">Ziel</PreviewButton>
              <PreviewButton>Team-Ziel</PreviewButton>
              <PreviewButton variant="outline">Rangliste</PreviewButton>
            </PreviewGrid>
            <PreviewInput label="Ziel fürs ganze Team" value="500 t" focused />
            <PreviewInput label="Preis (optional)" value="Shaker für alle" />
          </PreviewStack>
        ),
      },
      {
        title: "Duelle deiner Athleten",
        text: "Auf der Challenges-Seite siehst du, gegen wen deine Athleten antreten und wie es steht, auch gegen Athleten anderer Coaches.",
        icon: Swords,
        roles: ["coach"],
      },
      {
        title: "Abweichende Übungen erkennen",
        text: "Hat dein Athlet an einem anderen Gerät oder Gym trainiert, ist die Übung als „Abweichend“ markiert. In der Übungsstatistik kannst du sie ausblenden.",
        icon: Shuffle,
        roles: ["coach"],
      },
      {
        title: "System-Challenges planen",
        text: "Leg wöchentliche, monatliche oder einmalige Challenges für alle Athleten an, mit Bronze, Silber und Gold. Die Runden starten automatisch.",
        icon: Globe,
        roles: ["sysadmin"],
      },
    ],
  },
  {
    id: "3.3",
    version: "3.3",
    date: "2026-10-23",
    items: [
      {
        title: "Protokoll beim Planen",
        text: "Klapp im Plan eine Übung auf und du siehst, was dein Athlet zuletzt geschafft hat. So trägst du leicht passende Gewichte ein.",
        icon: History,
        roles: ["coach"],
        preview: protocolPreview("Protokoll von Max"),
      },
      {
        title: "Dein Protokoll beim Planen",
        text: "Klapp im Plan eine Übung auf und du siehst, was du zuletzt geschafft hast. So planst du die nächsten Gewichte leichter.",
        icon: History,
        roles: ["athlete"],
        permissions: ["ownPlan"],
        preview: protocolPreview("Dein Protokoll"),
      },
      {
        title: "Verlauf nach Wochen",
        text: "Deine Trainings stehen jetzt nach Wochen sortiert, mit Sätzen und Bewertung auf einen Blick. Ältere lädst du einfach unten nach.",
        icon: CalendarDays,
        roles: ["athlete"],
        preview: (
          <PreviewStack>
            <PreviewRow>
              <PreviewText grow>Diese Woche</PreviewText>
              <PreviewText size="sm" muted>
                2 Einheiten · 31 Sätze
              </PreviewText>
            </PreviewRow>
            <PreviewCard>
              <PreviewRow>
                <PreviewTextGroup grow>
                  <PreviewText>Oberkörper B</PreviewText>
                  <PreviewText size="sm" muted>
                    Do · 15 Sätze
                  </PreviewText>
                </PreviewTextGroup>
                <PreviewChip>★ 8</PreviewChip>
              </PreviewRow>
            </PreviewCard>
            <PreviewButton variant="outline">Ältere Trainings laden</PreviewButton>
          </PreviewStack>
        ),
      },
    ],
  },
  {
    id: "3.2",
    version: "3.2",
    date: "2026-10-18",
    items: [
      {
        title: "Eigene Übungen anlegen",
        text: "Fehlt beim Planen eine Übung im Katalog? Leg sie direkt an. Nur du siehst sie, dein Coach kann sie prüfen.",
        icon: ListPlus,
        roles: ["athlete"],
        permissions: ["ownPlan"],
        preview: (
          <PreviewStack>
            <PreviewInput label="Name" value="Pistol Squat" focused />
            <PreviewCard tone="accent">
              <PreviewText size="sm" tone="accent">
                Meinst du eine dieser Übungen?
              </PreviewText>
              <PreviewRow>
                <PreviewText grow>Bulgarian Split Squat</PreviewText>
                <PreviewChip>Verwenden</PreviewChip>
              </PreviewRow>
            </PreviewCard>
          </PreviewStack>
        ),
      },
      {
        title: "Dein Verlauf bleibt erhalten",
        text: "Übernimmt oder ersetzt dein Coach eine deiner Übungen, laufen Pläne, Trainings und dein Verlauf einfach weiter. Ein Hinweis sagt dir, was sich geändert hat.",
        icon: Replace,
        roles: ["athlete"],
        permissions: ["ownPlan"],
      },
      {
        title: "Übungen deiner Athleten",
        text: "Unter Übungen → Von Athleten siehst du, was deine Athleten angelegt haben. Übernimm sie in deinen Katalog oder ersetze sie durch eine vorhandene.",
        icon: Inbox,
        roles: ["coach"],
        preview: (
          <PreviewStack>
            <PreviewCard>
              <PreviewRow>
                <PreviewTextGroup grow>
                  <PreviewText>Pistol Squat</PreviewText>
                  <PreviewText size="sm" muted>
                    von Anna · Grundübung
                  </PreviewText>
                </PreviewTextGroup>
                <PreviewChip>Übernehmen</PreviewChip>
              </PreviewRow>
            </PreviewCard>
            <PreviewCard>
              <PreviewRow>
                <PreviewTextGroup grow>
                  <PreviewText>Tiefe Hocke</PreviewText>
                  <PreviewText size="sm" muted>
                    von Ben · Grundübung
                  </PreviewText>
                </PreviewTextGroup>
                <PreviewChip>Ersetzen</PreviewChip>
              </PreviewRow>
            </PreviewCard>
          </PreviewStack>
        ),
      },
      {
        title: "Für alle Coaches vorschlagen",
        text: "Eine eigene Übung ist so gut, dass alle sie haben sollten? Schlag sie für den globalen Katalog vor, der Sysadmin prüft den Vorschlag.",
        icon: Globe,
        roles: ["coach"],
      },
      {
        title: "Vorschläge der Coaches",
        text: "Unter Übungskatalog → Vorschläge übernimmst du Übungen der Coaches in den globalen Katalog oder ersetzt sie durch eine vorhandene.",
        icon: Inbox,
        roles: ["sysadmin"],
      },
    ],
  },
  {
    id: "3.1",
    version: "3.1",
    date: "2026-10-18",
    roles: ["athlete"],
    items: [
      {
        title: "Neue Trainingsseite",
        text: "Dein nächstes Training steht ganz oben, mit Übungen, Sätzen und Dauer – ein Tipp und du legst los. Passt es heute nicht, sagst du es direkt ab.",
        icon: CalendarCheck,
        preview: (
          <PreviewStack>
            <PreviewCard tone="accent">
              <PreviewRow>
                <PreviewTextGroup grow>
                  <PreviewText size="sm" tone="accent">
                    Als Nächstes
                  </PreviewText>
                  <PreviewText size="lg">Oberkörper B</PreviewText>
                  <PreviewText size="sm" muted>
                    4 Übungen · ~50 min
                  </PreviewText>
                </PreviewTextGroup>
                <PreviewThumb src={upperBody} />
              </PreviewRow>
            </PreviewCard>
            <PreviewWeek days={["done", "done", "free", "next", "free", "free", "free"]} />
            <PreviewButton>Training starten</PreviewButton>
          </PreviewStack>
        ),
      },
      {
        title: "Pausentimer startet automatisch",
        text: "Hak einen Satz ab und der Countdown aus deinem Plan läuft los. Mit −15 / +15 passt du ihn an, oder du überspringst die Pause.",
        icon: Timer,
        preview: (
          <PreviewStack>
            <PreviewRow variant="highlight">
              <PreviewNumber>2</PreviewNumber>
              <PreviewText grow>80 kg × 8</PreviewText>
              <PreviewCheck />
            </PreviewRow>
            <PreviewCard tone="primary">
              <PreviewRow>
                <PreviewTextGroup grow>
                  <PreviewText size="sm" muted>
                    Pause · Bankdrücken
                  </PreviewText>
                  <PreviewText size="xl">1:48</PreviewText>
                </PreviewTextGroup>
                <PreviewChip>−15</PreviewChip>
                <PreviewChip>+15</PreviewChip>
              </PreviewRow>
              <PreviewProgress value={0.72} />
            </PreviewCard>
          </PreviewStack>
        ),
      },
      {
        title: "Übung spontan hinzufügen",
        text: "Gerät besetzt oder Lust auf mehr? Gib einfach einen Namen ein, wähl die Sätze und leg los. Die Übung gilt nur für dieses Training.",
        icon: Plus,
        preview: (
          <PreviewStack>
            <PreviewInput label="Name" value="Butterfly" focused />
            <PreviewStepper label="Sätze" value={3} />
            <PreviewButton>Übung hinzufügen</PreviewButton>
          </PreviewStack>
        ),
      },
      {
        title: "Deine Bestleistungen im Blick",
        text: "Nach jedem Training zeigen wir dir neue Rekorde – schwerstes Gewicht oder mehr Wiederholungen – und wie du dich zum letzten Mal entwickelt hast.",
        icon: Trophy,
        tone: "records",
        preview: (
          <PreviewStack center>
            <PreviewIcon icon={Trophy} tone="records" />
            <PreviewCard tone="records">
              <PreviewRow>
                <PreviewTextGroup grow>
                  <PreviewText>Kreuzheben</PreviewText>
                  <PreviewText size="sm" muted>
                    Schwerstes Gewicht
                  </PreviewText>
                </PreviewTextGroup>
                <PreviewTextGroup align="right">
                  <PreviewText size="lg">125 kg × 5</PreviewText>
                  <PreviewText size="sm" tone="records">
                    +5 kg
                  </PreviewText>
                </PreviewTextGroup>
              </PreviewRow>
            </PreviewCard>
          </PreviewStack>
        ),
      },
      {
        title: "Übersichtlicher Trainingsplan",
        text: "Größere Eingabefelder, Sätze mit Nummer und Haken und fertige Übungen, die sich automatisch zuklappen – alles gut mit dem Daumen erreichbar.",
        icon: LayoutGrid,
        preview: (
          <PreviewStack>
            <PreviewGrid columns={3}>
              <PreviewTile filled />
              <PreviewTile filled />
              <PreviewTile />
            </PreviewGrid>
            <PreviewButton variant="dashed">+ Satz kopiert den letzten</PreviewButton>
          </PreviewStack>
        ),
      },
    ],
  },
];
