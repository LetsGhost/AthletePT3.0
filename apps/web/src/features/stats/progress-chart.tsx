import type { ExerciseSession } from "@athletept/shared";
import {
  CategoryScale,
  Chart,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { useEffect, useRef, useState } from "react";

import { formatWeekdayDate } from "@/features/workouts/format";

import {
  chartLabels,
  formatBestSet,
  formatChartValue,
  formatShortDate,
  type ChartKind,
} from "./format";

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip);

/** Aktuelles Theme als Zähler, damit das Diagramm bei einem Wechsel neue Farben bekommt. */
function useThemeKey() {
  const [key, setKey] = useState(() => document.documentElement.dataset.theme ?? "");
  useEffect(() => {
    const observer = new MutationObserver(() =>
      setKey(document.documentElement.dataset.theme ?? ""),
    );
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);
  return key;
}

function token(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888";
}

interface ProgressChartProps {
  sessions: readonly ExerciseSession[];
  kind: ChartKind;
  /** Beschreibung für Screenreader; die Werte stehen zusätzlich in der Liste der Einheiten. */
  label: string;
}

/** Verlauf einer Kennzahl. Das Canvas ist für Screenreader ein Bild mit Zusammenfassung. */
export function ProgressChart({ sessions, kind, label }: ProgressChartProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const theme = useThemeKey();

  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    const accent = token("--accent");
    const muted = token("--text-muted");
    const border = token("--border");
    const surface = token("--surface");
    const chart = new Chart(context, {
      type: "line",
      data: {
        labels: sessions.map((s) => formatShortDate(s.date)),
        datasets: [
          {
            label: chartLabels[kind],
            data: sessions.map((s) => s[kind]),
            borderColor: accent,
            backgroundColor: accent,
            // Abweichende Trainings: hohle Raute statt gefülltem Punkt (Form, nicht nur Farbe).
            pointBackgroundColor: sessions.map((s) => (s.deviating ? surface : accent)),
            pointStyle: sessions.map((s) => (s.deviating ? "rectRot" : "circle")),
            pointBorderWidth: sessions.map((s) => (s.deviating ? 2 : 1)),
            pointRadius: 4,
            pointHoverRadius: 6,
            borderWidth: 2.2,
            tension: 0.25,
            spanGaps: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? false
          : undefined,
        interaction: { mode: "index", intersect: false },
        scales: {
          x: {
            ticks: { color: muted, maxRotation: 0, autoSkipPadding: 12 },
            grid: { display: false },
          },
          y: {
            ticks: {
              color: muted,
              maxTicksLimit: 4,
              callback: (value) => formatChartValue(kind, Number(value)),
            },
            grid: { color: border },
            border: { display: false },
          },
        },
        plugins: {
          tooltip: {
            callbacks: {
              title: ([item]) => (item ? formatWeekdayDate(sessions[item.dataIndex]!.date) : ""),
              label: (item) => formatChartValue(kind, Number(item.parsed.y)),
              footer: ([item]) => {
                const session = item && sessions[item.dataIndex];
                if (!session) return [];
                const bestSet = formatBestSet(session);
                const note = session.notes?.trim();
                return [
                  ...(bestSet ? [`Bester Satz ${bestSet}`] : []),
                  ...(session.deviating ? ["Abweichend"] : []),
                  ...(session.deviating && note
                    ? [note.length > 60 ? `${note.slice(0, 59)}…` : note]
                    : []),
                ];
              },
            },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [sessions, kind, theme]);

  return (
    <div className="relative h-52 w-full">
      <canvas ref={canvas} role="img" aria-label={label} />
    </div>
  );
}
