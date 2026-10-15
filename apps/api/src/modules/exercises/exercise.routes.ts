import {
  createExerciseRequestSchema,
  exerciseListQuerySchema,
  exerciseListResponseSchema,
  exerciseSchema,
  objectIdSchema,
  updateExerciseRequestSchema,
} from "@athletept/shared";
import { z } from "zod";

import { createModuleRouter } from "../../lib/router";
import * as exerciseService from "./exercise.service";

const exercises = createModuleRouter("/exercises", "Übungen");
const idParams = z.object({ id: objectIdSchema });
const roles = ["coach", "sysadmin"] as const;

exercises.route({
  method: "get",
  path: "/",
  summary: "Übungen suchen",
  description:
    "Coaches sehen den globalen Katalog und ihre eigenen Übungen, der Sysadmin nur den globalen " +
    "Katalog. Treffer, deren Name mit dem Suchbegriff beginnt, stehen vorne.",
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
    "Coaches legen eigene Übungen an, der Sysadmin globale. Namen sind pro Katalog eindeutig " +
    "(409 `exercise_name_taken`).",
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
  description: "Globale Übungen kann nur der Sysadmin ändern (403 `exercise_readonly`).",
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
  description: "Verschwindet aus der Auswahl, bestehende Pläne behalten sie.",
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

export const exerciseRouter = exercises;
