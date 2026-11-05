import type { ChallengeWorkoutUpdate } from "@athletept/shared";
import { ArrowUp, Trophy } from "lucide-react";
import { Link } from "react-router";

import { cn } from "@/lib/cn";

import { ChallengeIcon } from "./challenge-visuals";
import { kindTone } from "./tones";
import { workoutUpdateText } from "./format";

function standing(update: ChallengeWorkoutUpdate) {
  if (update.entryPending) return { text: "Eintragen", up: false };
  if (update.kind === "duel") {
    return { text: update.rank === 1 ? "Du führst" : "Dranbleiben", up: false };
  }
  if (update.scoring !== "ranking" || update.participantCount < 2) return null;
  const climbed = update.previousRank - update.rank;
  return { text: `Platz ${update.rank}`, up: climbed > 0, climbed };
}

/** Abschluss-Bildschirm: was das Training in laufenden Challenges bewirkt hat. */
export function WorkoutChallenges({ updates }: { updates: readonly ChallengeWorkoutUpdate[] }) {
  if (updates.length === 0) return null;
  return (
    <section
      aria-labelledby="summary-challenges"
      className="bg-surface flex flex-col gap-1 rounded-tile p-4"
    >
      <div className="flex items-center justify-between pb-1">
        <h2 id="summary-challenges" className="flex items-center gap-2 font-semibold">
          <Trophy aria-hidden="true" className="text-accent size-4" /> Challenges
        </h2>
        <Link to="/challenges" className="text-accent text-sm">
          Alle
        </Link>
      </div>
      <ul>
        {updates.map((update) => {
          const side = standing(update);
          return (
            <li key={update.id}>
              <Link
                to={`/challenges/${update.id}`}
                className="border-border flex items-center gap-3 border-t py-2.5"
              >
                <ChallengeIcon kind={update.kind} metric={update.metric} className="size-9" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">
                    {update.kind === "duel" ? `Duell · ${update.title}` : update.title}
                  </span>
                  <span className="text-muted text-xs">{workoutUpdateText(update)}</span>
                </span>
                {side && (
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold whitespace-nowrap",
                      kindTone[update.kind].text,
                    )}
                  >
                    {side.text}
                    {side.up && (
                      <>
                        <ArrowUp aria-hidden="true" className="size-3" />
                        {side.climbed}
                        <span className="sr-only"> Plätze nach oben</span>
                      </>
                    )}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
