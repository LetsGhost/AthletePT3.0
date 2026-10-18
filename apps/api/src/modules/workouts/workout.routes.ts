import {
  objectIdSchema,
  skipWorkoutRequestSchema,
  startWorkoutRequestSchema,
  updateWeeklyActivitiesRequestSchema,
  completeWorkoutResponseSchema,
  updateWorkoutRequestSchema,
  weekQuerySchema,
  weekViewSchema,
  weeklyActivitiesResponseSchema,
  workoutLogListQuerySchema,
  workoutLogListResponseSchema,
  workoutLogSchema,
} from "@athletept/shared";
import { z } from "zod";

import { createModuleRouter } from "../../lib/router";
import * as weekService from "./week.service";
import * as workoutService from "./workout.service";

const me = createModuleRouter("/me", "Eigenes Training");
const logParams = z.object({ id: objectIdSchema });

me.route({
  method: "get",
  path: "/week",
  summary: "Eigene Trainingswoche",
  description:
    "Tage des aktiven Plans mit Status, Protokolle und Wochenplan der ISO-Woche (`week`, z. B. " +
    "`2026-W42`, ohne Angabe die aktuelle). Wird berechnet, nichts davon ist gespeichert.",
  auth: ["athlete"],
  query: weekQuerySchema,
  response: weekViewSchema,
  handler: ({ auth, query }) => weekService.getMyWeek(auth.userId, query.week),
});

me.route({
  method: "get",
  path: "/workout-logs",
  summary: "Eigene Trainings auflisten",
  description: "Neueste zuerst, inklusive laufender und abgesagter.",
  auth: ["athlete"],
  query: workoutLogListQuerySchema,
  response: workoutLogListResponseSchema,
  handler: ({ auth, query }) => workoutService.listMyWorkouts(auth.userId, query),
});

me.route({
  method: "post",
  path: "/workout-logs",
  summary: "Training starten",
  description:
    "Legt ein laufendes Protokoll für einen Tag des aktiven Plans an, vorbefüllt mit den " +
    "Vorgaben. `date` (ohne Angabe heute) darf höchstens 14 Tage zurückliegen. Läuft schon ein " +
    "Training: 409 `workout_in_progress`. Ohne aktiven Plan: 409 `no_active_plan`.",
  auth: ["athlete"],
  body: startWorkoutRequestSchema,
  status: 201,
  response: workoutLogSchema,
  errors: [404, 409],
  handler: ({ auth, body }) => workoutService.startWorkout(auth.userId, body),
});

me.route({
  method: "post",
  path: "/workout-logs/skip",
  summary: "Training absagen",
  description:
    "Legt ein abgesagtes Protokoll an, optional mit Grund (`notes`). Ist der Tag in dieser Woche " +
    "schon erledigt oder abgesagt: 409 `workout_already_logged`.",
  auth: ["athlete"],
  body: skipWorkoutRequestSchema,
  status: 201,
  response: workoutLogSchema,
  errors: [404, 409],
  handler: ({ auth, body }) => workoutService.skipWorkout(auth.userId, body),
});

me.route({
  method: "get",
  path: "/workout-logs/:id",
  summary: "Eigenes Training abrufen",
  description: "Mit den zuletzt geschafften Sätzen je Übung (`previous`).",
  auth: ["athlete"],
  params: logParams,
  response: workoutLogSchema,
  errors: [404],
  handler: ({ auth, params }) => workoutService.getMyWorkout(auth.userId, params.id),
});

me.route({
  method: "put",
  path: "/workout-logs/:id",
  summary: "Training zwischenspeichern oder korrigieren",
  description:
    "Ersetzt Sätze, Bewertung und Notizen. `revision` muss dem zuletzt geladenen Stand " +
    "entsprechen, sonst 409 `workout_conflict`. Abgeschlossene Trainings lassen sich 7 Tage lang " +
    "korrigieren (danach 409 `workout_locked`), abgesagte gar nicht (409 `workout_skipped`).",
  auth: ["athlete"],
  params: logParams,
  body: updateWorkoutRequestSchema,
  response: workoutLogSchema,
  errors: [404, 409],
  handler: ({ auth, params, body }) => workoutService.updateMyWorkout(auth.userId, params.id, body),
});

me.route({
  method: "post",
  path: "/workout-logs/:id/complete",
  summary: "Training abschließen",
  description:
    "Speichert den mitgeschickten Stand und schließt das laufende Training ab. `newRecords`: " +
    "Bestwerte, die das Training verbessert hat (nicht beim ersten Mal einer Übung). " +
    "`averageDurationMinutes`: Durchschnitt der letzten 10 früheren Trainings.",
  auth: ["athlete"],
  params: logParams,
  body: updateWorkoutRequestSchema,
  response: completeWorkoutResponseSchema,
  errors: [404, 409],
  handler: ({ auth, params, body }) =>
    workoutService.completeMyWorkout(auth.userId, params.id, body),
});

me.route({
  method: "delete",
  path: "/workout-logs/:id",
  summary: "Training verwerfen oder Absage zurücknehmen",
  description: "Abgeschlossene Trainings lassen sich nicht löschen (409 `workout_completed`).",
  auth: ["athlete"],
  params: logParams,
  status: 204,
  errors: [404, 409],
  handler: async ({ auth, params }) => {
    await workoutService.deleteMyWorkout(auth.userId, params.id);
  },
});

export const myWorkoutRouter = me;

// Lesender Zugriff für den Coach, Owner-Prüfung über den Athleten.
const athletes = createModuleRouter("/athletes", "Trainingsprotokolle");
const athleteParams = z.object({ athleteId: objectIdSchema });

athletes.route({
  method: "get",
  path: "/:athleteId/week",
  summary: "Trainingswoche eines Athleten",
  description: "Wie `GET /me/week`, aber ohne laufende Trainings.",
  auth: ["coach"],
  params: athleteParams,
  query: weekQuerySchema,
  response: weekViewSchema,
  errors: [404],
  handler: ({ auth, params, query }) =>
    weekService.getAthleteWeek(auth.userId, params.athleteId, query.week),
});

athletes.route({
  method: "put",
  path: "/:athleteId/weekly-activities",
  summary: "Wochenplan eines Athleten setzen",
  description:
    "Sieben Freitexte von Montag bis Sonntag (z. B. „Laufen“), leer oder `null` für nichts. " +
    "Unabhängig vom Trainingsplan. Athleten mit der Berechtigung `ownWeek` setzen ihn mit ihrer " +
    "eigenen ID selbst.",
  auth: ["coach", "athlete"],
  params: athleteParams,
  body: updateWeeklyActivitiesRequestSchema,
  response: weeklyActivitiesResponseSchema,
  errors: [404],
  handler: ({ auth, params, body }) =>
    weekService.updateWeeklyActivities(auth, params.athleteId, body.activities),
});

athletes.route({
  method: "get",
  path: "/:athleteId/workout-logs",
  summary: "Trainings eines Athleten auflisten",
  description: "Abgeschlossene und abgesagte Trainings, neueste zuerst.",
  auth: ["coach"],
  params: athleteParams,
  query: workoutLogListQuerySchema,
  response: workoutLogListResponseSchema,
  errors: [404],
  handler: ({ auth, params, query }) =>
    workoutService.listAthleteWorkouts(auth.userId, params.athleteId, query),
});

athletes.route({
  method: "get",
  path: "/:athleteId/workout-logs/:id",
  summary: "Training eines Athleten abrufen",
  auth: ["coach"],
  params: athleteParams.extend({ id: objectIdSchema }),
  response: workoutLogSchema,
  errors: [404],
  handler: ({ auth, params }) =>
    workoutService.getAthleteWorkout(auth.userId, params.athleteId, params.id),
});

export const athleteWorkoutRouter = athletes;
