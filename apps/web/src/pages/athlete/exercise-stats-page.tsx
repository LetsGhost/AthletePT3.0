import { Link } from "react-router";

import { useMyStats } from "@/features/stats/api";
import { ExerciseStatsPage } from "@/features/stats/exercise-list";

export default function AthleteExerciseStatsPage() {
  return (
    <ExerciseStatsPage
      query={useMyStats()}
      backHref="/fortschritt"
      backLabel="Fortschritt"
      href={(exerciseId) => `/fortschritt/${exerciseId}`}
      emptyText="Sobald du dein erstes Training abschließt, siehst du hier deine Entwicklung je Übung."
      emptyAction={
        <Link
          to="/plan"
          className="bg-primary text-on-primary hover:bg-primary-hover inline-flex min-h-11 items-center rounded-card px-4 text-sm font-medium"
        >
          Zum Training
        </Link>
      }
    />
  );
}
