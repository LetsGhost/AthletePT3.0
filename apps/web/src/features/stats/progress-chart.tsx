import type { ExerciseSession, StatsMetric } from "@athletept/shared";
import {
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { useEffect, useRef, useState } from "react";

import { formatWeekdayDate } from "@/features/workouts/format";

import { formatRecordValue, metricLabels } from "./format";

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
);

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
  metric: StatsMetric;
  /** Beschreibung für Screenreader; die Werte stehen zusätzlich in einer Tabelle. */
  label: string;
}

/**
 * Verlauf der Hauptkennzahl (bei Übungen mit Gewicht zusätzlich das höchste Gewicht). Das Canvas
 * ist für Screenreader ein Bild mit Zusammenfassung, die Daten stehen in der Tabelle daneben.
 */
export function ProgressChart({ sessions, metric, label }: ProgressChartProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const theme = useThemeKey();

  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    const accent = token("--accent");
    const muted = token("--text-muted");
    const border = token("--border");
    const secondary = token("--module-records");
    const datasets = [
      {
        label: metricLabels[metric],
        data: sessions.map((s) => s[metric]),
        borderColor: accent,
        backgroundColor: accent,
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: 2,
        tension: 0.25,
        spanGaps: true,
      },
    ];
    if (metric === "estimated1rm") {
      datasets.push({
        label: "Höchstes Gewicht",
        data: sessions.map((s) => s.topWeightKg),
        borderColor: secondary,
        backgroundColor: secondary,
        pointRadius: 3,
        pointHoverRadius: 5,
        borderWidth: 2,
        tension: 0.25,
        spanGaps: true,
      });
    }
    const unitKind = metric === "estimated1rm" ? "topWeightKg" : metric;
    const chart = new Chart(context, {
      type: "line",
      data: { labels: sessions.map((s) => formatWeekdayDate(s.date)), datasets },
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
              callback: (value) => formatRecordValue(unitKind, Number(value)),
            },
            grid: { color: border },
          },
        },
        plugins: {
          legend: {
            display: datasets.length > 1,
            labels: { color: muted, boxWidth: 12, boxHeight: 12 },
          },
          tooltip: {
            callbacks: {
              label: (item) =>
                `${item.dataset.label}: ${formatRecordValue(unitKind, Number(item.parsed.y))}`,
            },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [sessions, metric, theme]);

  return (
    <div className="relative h-64 w-full">
      <canvas ref={canvas} role="img" aria-label={label} />
    </div>
  );
}
