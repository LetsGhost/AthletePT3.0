import {
  exerciseStatsDetailSchema,
  exerciseStatsListResponseSchema,
  objectIdSchema,
} from "@athletept/shared";
import { z } from "zod";

import { createModuleRouter } from "../../lib/router";
import * as statsService from "./exercise-stats.service";

const me = createModuleRouter("/me", "Fortschritt");

me.route({
  method: "get",
  path: "/exercise-stats",
  summary: "Eigener Fortschritt je Übung",
  description:
    "Alle trainierten Übungen mit Bestwerten und Veränderung über die letzten 16 Einheiten, " +
    "dazu die Rekorde (höchstes geschätztes Maximum). Zählt nur erledigte Arbeitssätze " +
    "abgeschlossener Trainings.",
  auth: ["athlete"],
  response: exerciseStatsListResponseSchema,
  handler: ({ auth }) => statsService.listMyStats(auth.userId),
});

me.route({
  method: "get",
  path: "/exercise-stats/:exerciseId",
  summary: "Eigener Verlauf einer Übung",
  description: "Die letzten 16 Einheiten, älteste zuerst. Ohne Trainings: 404.",
  auth: ["athlete"],
  params: z.object({ exerciseId: objectIdSchema }),
  response: exerciseStatsDetailSchema,
  errors: [404],
  handler: ({ auth, params }) => statsService.getMyExerciseStats(auth.userId, params.exerciseId),
});

export const myStatsRouter = me;

const athletes = createModuleRouter("/athletes", "Fortschritt");
const athleteParams = z.object({ athleteId: objectIdSchema });

athletes.route({
  method: "get",
  path: "/:athleteId/exercise-stats",
  summary: "Fortschritt eines Athleten je Übung",
  auth: ["coach"],
  params: athleteParams,
  response: exerciseStatsListResponseSchema,
  errors: [404],
  handler: ({ auth, params }) => statsService.listAthleteStats(auth.userId, params.athleteId),
});

athletes.route({
  method: "get",
  path: "/:athleteId/exercise-stats/:exerciseId",
  summary: "Verlauf einer Übung eines Athleten",
  auth: ["coach"],
  params: athleteParams.extend({ exerciseId: objectIdSchema }),
  response: exerciseStatsDetailSchema,
  errors: [404],
  handler: ({ auth, params }) =>
    statsService.getAthleteExerciseStats(auth.userId, params.athleteId, params.exerciseId),
});

export const athleteStatsRouter = athletes;
