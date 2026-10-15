import { sexLabels, type AthleteProfile } from "@athletept/shared";
import type { ReactNode } from "react";

import { ageFromIsoDate, formatIsoDate } from "@/lib/format";

type Row = { label: string; value: ReactNode };

function rows(profile: AthleteProfile): Row[] {
  const result: (Row | false)[] = [
    !!profile.birthDate && {
      label: "Geburtsdatum",
      value: `${formatIsoDate(profile.birthDate)} (${ageFromIsoDate(profile.birthDate)} Jahre)`,
    },
    !!profile.sex && { label: "Geschlecht", value: sexLabels[profile.sex] },
    profile.heightCm !== undefined && { label: "Größe", value: `${profile.heightCm} cm` },
    !!profile.goal && { label: "Ziel", value: profile.goal },
    !!profile.focus && { label: "Fokus", value: profile.focus },
    profile.trainingsPerWeek !== undefined && {
      label: "Trainings pro Woche",
      value: profile.trainingsPerWeek,
    },
    !!profile.trainingLocation && { label: "Trainingsort", value: profile.trainingLocation },
    !!profile.trainingTimes && { label: "Trainingszeiten", value: profile.trainingTimes },
    !!profile.otherSports && { label: "Andere Sportarten", value: profile.otherSports },
    !!profile.cardio && { label: "Cardio", value: profile.cardio },
    !!profile.physicalIssues && { label: "Körperliche Beschwerden", value: profile.physicalIssues },
    !!profile.conditions && { label: "Vorerkrankungen", value: profile.conditions },
    !!profile.coachNotes && { label: "Interne Notizen", value: profile.coachNotes },
  ];
  return result.filter((row): row is Row => row !== false);
}

export function ProfileSummary({ profile }: { profile: AthleteProfile }) {
  const items = rows(profile);
  if (items.length === 0) {
    return <p className="text-muted">Noch keine Angaben erfasst.</p>;
  }
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[12rem_1fr]">
      {items.map(({ label, value }) => (
        <div key={label} className="contents">
          <dt className="text-muted text-sm sm:pt-0.5">{label}</dt>
          <dd className="whitespace-pre-line">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
