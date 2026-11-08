import { useParams } from "react-router";

import { useAthleteStats } from "@/features/stats/api";
import { ExerciseStatsPage } from "@/features/stats/exercise-list";

export default function CoachExerciseStatsPage() {
  const { id = "" } = useParams();
  return (
    <ExerciseStatsPage
      query={useAthleteStats(id)}
      backHref={`/coach/athletes/${id}`}
      backLabel="Zum Athleten"
      href={(exerciseId) => `/coach/athletes/${id}/entwicklung/${exerciseId}`}
      emptyText="Sobald dein Athlet Trainings abschließt, siehst du hier die Entwicklung je Übung."
    />
  );
}
