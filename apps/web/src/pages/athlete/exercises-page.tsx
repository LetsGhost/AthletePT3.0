import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";

import { ExerciseCatalog } from "@/features/exercises/exercise-catalog";

/** Private Übungen (Berechtigung „Eigener Trainingsplan“, sonst zeigt die API 403). */
export default function AthleteExercisesPage() {
  return (
    <>
      <Link
        to="/plan"
        className="text-muted hover:text-text mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Training
      </Link>
      <ExerciseCatalog mode="athlete" />
    </>
  );
}
