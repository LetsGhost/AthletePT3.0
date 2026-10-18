/**
 * Inhalte des „Was ist neu“-Dialogs. Neueste Version OBEN einfügen.
 * Anleitung: README.md in diesem Ordner.
 */
import { CalendarCheck, LayoutGrid, Plus, Timer, Trophy } from "lucide-react";

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

export const releaseNotes: WhatsNewRelease[] = [
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
