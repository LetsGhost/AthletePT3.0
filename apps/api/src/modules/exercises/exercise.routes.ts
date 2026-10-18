import {
  createExerciseRequestSchema,
  exerciseListQuerySchema,
  exerciseListResponseSchema,
  exerciseNoticeListResponseSchema,
  exerciseSchema,
  objectIdSchema,
  ownedExerciseListResponseSchema,
  replaceExerciseRequestSchema,
  updateExerciseRequestSchema,
} from "@athletept/shared";
import { z } from "zod";

import { createModuleRouter } from "../../lib/router";
import { replaceExercise } from "./exercise-merge";
import * as exerciseService from "./exercise.service";

const exercises = createModuleRouter("/exercises", "Übungen");
const idParams = z.object({ id: objectIdSchema });
/**
 * Lesen und im eigenen Katalog anlegen und ändern: Coaches, Sysadmin und Athleten mit eigenem
 * Trainingsplan (Katalog ihres Coaches plus private Übungen, sonst 403).
 */
const roles = ["coach", "sysadmin", "athlete"] as const;

// Feste Pfade vor `/:id`, sonst würden sie als ID gelesen.
exercises.route({
  method: "get",
  path: "/athlete-exercises",
  summary: "Private Übungen der eigenen Athleten",
  description: "Aktive private Übungen aller Athleten des Coaches, neueste zuerst.",
  auth: ["coach"],
  response: ownedExerciseListResponseSchema,
  handler: ({ auth }) => exerciseService.listAthleteExercises(auth),
});

exercises.route({
  method: "get",
  path: "/submissions",
  summary: "Vorgeschlagene Übungen",
  description: "Übungen, die Coaches für den globalen Katalog vorgeschlagen haben, älteste zuerst.",
  auth: ["sysadmin"],
  response: ownedExerciseListResponseSchema,
  handler: () => exerciseService.listSubmissions(),
});

exercises.route({
  method: "get",
  path: "/notices",
  summary: "Hinweise zu übernommenen Übungen",
  description:
    "Hinweise an Athleten (Coach hat eine private Übung übernommen) und Coaches (Sysadmin hat " +
    "eine vorgeschlagene Übung übernommen), neueste zuerst.",
  auth: ["athlete", "coach"],
  response: exerciseNoticeListResponseSchema,
  handler: ({ auth }) => exerciseService.listNotices(auth),
});

exercises.route({
  method: "delete",
  path: "/notices/:id",
  summary: "Hinweis wegklicken",
  auth: ["athlete", "coach"],
  params: idParams,
  status: 204,
  errors: [404],
  handler: ({ auth, params }) => exerciseService.dismissNotice(auth, params.id),
});

exercises.route({
  method: "get",
  path: "/",
  summary: "Übungen suchen",
  description:
    "Coaches sehen den globalen Katalog und ihre eigenen Übungen, der Sysadmin nur den globalen " +
    "Katalog, Athleten mit eigenem Trainingsplan den Katalog ihres Coaches und ihre privaten " +
    "Übungen (sonst 403). Treffer, deren Name mit dem Suchbegriff beginnt, stehen vorne.",
  auth: roles,
  query: exerciseListQuerySchema,
  response: exerciseListResponseSchema,
  handler: ({ auth, query }) => exerciseService.listExercises(auth, query),
});

exercises.route({
  method: "get",
  path: "/:id",
  summary: "Übung abrufen",
  auth: roles,
  params: idParams,
  response: exerciseSchema,
  errors: [404],
  handler: ({ auth, params }) => exerciseService.getExercise(auth, params.id),
});

exercises.route({
  method: "post",
  path: "/",
  summary: "Übung anlegen",
  description:
    "Coaches legen eigene Übungen an, der Sysadmin globale, Athleten private. Namen sind pro " +
    "Katalog eindeutig (409 `exercise_name_taken`). Athleten können nichts anlegen, dessen Name " +
    "oder Synonym eine sichtbare Übung trifft (409 `exercise_exists`).",
  auth: roles,
  body: createExerciseRequestSchema,
  status: 201,
  response: exerciseSchema,
  errors: [409],
  handler: ({ auth, body }) => exerciseService.createExercise(auth, body),
});

exercises.route({
  method: "patch",
  path: "/:id",
  summary: "Übung bearbeiten",
  description:
    "Nur Übungen des eigenen Katalogs, andere sichtbare liefern 403 `exercise_readonly`.",
  auth: roles,
  params: idParams,
  body: updateExerciseRequestSchema,
  response: exerciseSchema,
  errors: [404, 409],
  handler: ({ auth, params, body }) => exerciseService.updateExercise(auth, params.id, body),
});

exercises.route({
  method: "post",
  path: "/:id/archive",
  summary: "Übung archivieren",
  description:
    "Verschwindet aus der Auswahl, bestehende Pläne behalten sie. Ein Vorschlag für den " +
    "globalen Katalog wird zurückgezogen.",
  auth: roles,
  params: idParams,
  response: exerciseSchema,
  errors: [404],
  handler: ({ auth, params }) => exerciseService.archiveExercise(auth, params.id),
});

exercises.route({
  method: "post",
  path: "/:id/restore",
  summary: "Archivierte Übung wiederherstellen",
  auth: roles,
  params: idParams,
  response: exerciseSchema,
  errors: [404, 409],
  handler: ({ auth, params }) => exerciseService.restoreExercise(auth, params.id),
});

exercises.route({
  method: "post",
  path: "/:id/adopt",
  summary: "Private Übung eines Athleten übernehmen",
  description:
    "Verschiebt die Übung in den Katalog des Coaches (ID bleibt). Der Athlet kann sie danach " +
    "nicht mehr ändern und bekommt einen Hinweis. Gleicher Name im Katalog: 409 " +
    "`exercise_name_taken`.",
  auth: ["coach"],
  params: idParams,
  response: exerciseSchema,
  errors: [404, 409],
  handler: ({ auth, params }) => exerciseService.adoptExercise(auth, params.id),
});

exercises.route({
  method: "post",
  path: "/:id/submit",
  summary: "Für den globalen Katalog vorschlagen",
  auth: ["coach"],
  params: idParams,
  response: exerciseSchema,
  errors: [404, 409],
  handler: ({ auth, params }) => exerciseService.setSubmitted(auth, params.id, true),
});

exercises.route({
  method: "post",
  path: "/:id/withdraw",
  summary: "Vorschlag zurückziehen",
  auth: ["coach"],
  params: idParams,
  response: exerciseSchema,
  errors: [404],
  handler: ({ auth, params }) => exerciseService.setSubmitted(auth, params.id, false),
});

exercises.route({
  method: "post",
  path: "/:id/publish",
  summary: "Vorgeschlagene Übung in den globalen Katalog übernehmen",
  description:
    "Verschiebt die Übung in den globalen Katalog (ID bleibt). Der Coach kann sie danach nicht " +
    "mehr ändern und bekommt einen Hinweis. Gleicher Name im Katalog: 409 `exercise_name_taken`.",
  auth: ["sysadmin"],
  params: idParams,
  response: exerciseSchema,
  errors: [404, 409],
  handler: ({ params }) => exerciseService.publishExercise(params.id),
});

exercises.route({
  method: "post",
  path: "/:id/replace",
  summary: "Übung durch eine Katalogübung ersetzen",
  description:
    "Coach: private Übung eines eigenen Athleten, Sysadmin: vorgeschlagene Coach-Übung. Alle " +
    "Pläne, Versionen, Vorlagen und Protokolle verwenden danach das Ziel, die Statistik läuft " +
    "dort weiter. Die Übung wird archiviert, ihr Besitzer bekommt einen Hinweis mit Begründung. " +
    "Später gespeicherte Anfragen mit der alten ID werden aufs Ziel umgeleitet. Antwort: das Ziel.",
  auth: ["coach", "sysadmin"],
  params: idParams,
  body: replaceExerciseRequestSchema,
  response: exerciseSchema,
  errors: [404],
  handler: ({ auth, params, body }) => replaceExercise(auth, params.id, body),
});

export const exerciseRouter = exercises;
