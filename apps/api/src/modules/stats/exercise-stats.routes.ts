import {
  activityQuerySchema,
  activityResponseSchema,
  exerciseStatsDetailSchema,
  exerciseStatsListResponseSchema,
  objectIdSchema,
} from "@athletept/shared";
import { z } from "zod";

import { createModuleRouter } from "../../lib/router";
import * as activityService from "./activity.service";
import * as statsService from "./exercise-stats.service";

const activityDescription =
  "Trainingskalender eines Monats (`month`, z. B. `2026-10`, ohne Angabe der aktuelle) mit " +
  "Streak. Eine Woche ist erfüllt, wenn mindestens ein Training abgeschlossen ist und am " +
  "Sonntag ein Plan aktiv war. Wochen ohne aktiven Plan pausieren die Streak, die " +
  "laufende Woche bricht sie erst, wenn sie vorbei ist.";

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

me.route({
  method: "get",
  path: "/activity",
  summary: "Eigener Trainingskalender mit Streak",
  description: activityDescription,
  auth: ["athlete"],
  query: activityQuerySchema,
  response: activityResponseSchema,
  handler: ({ auth, query }) => activityService.getMyActivity(auth.userId, query.month),
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

athletes.route({
  method: "get",
  path: "/:athleteId/activity",
  summary: "Trainingskalender eines Athleten mit Streak",
  description: activityDescription,
  auth: ["coach"],
  params: athleteParams,
  query: activityQuerySchema,
  response: activityResponseSchema,
  errors: [404],
  handler: ({ auth, params, query }) =>
    activityService.getAthleteActivity(auth.userId, params.athleteId, query.month),
});

export const athleteStatsRouter = athletes;
