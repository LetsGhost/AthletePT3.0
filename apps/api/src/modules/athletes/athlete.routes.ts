import {
  athleteDetailSchema,
  athleteListResponseSchema,
  athletePermissionsSchema,
  createAthleteRequestSchema,
  invitationResultSchema,
  objectIdSchema,
  updateAthleteRequestSchema,
} from "@athletept/shared";
import { z } from "zod";

import { createModuleRouter } from "../../lib/router";
import { mailLimiter } from "../../middleware/rate-limit";
import * as athleteService from "./athlete.service";

const athletes = createModuleRouter("/athletes", "Athleten");
const idParams = z.object({ id: objectIdSchema });

athletes.route({
  method: "get",
  path: "/",
  summary: "Eigene Athleten auflisten",
  description: "Alle Athleten des angemeldeten Coaches inklusive Kontingent.",
  auth: ["coach"],
  response: athleteListResponseSchema,
  handler: ({ auth }) => athleteService.listAthletes(auth.userId),
});

athletes.route({
  method: "post",
  path: "/",
  summary: "Athlet einladen",
  description:
    "Legt den Athleten mit Anamnese an und schickt eine Einladung per Mail. " +
    "Scheitert mit 409 `quota_exceeded`, wenn das Kontingent ausgeschöpft ist.",
  auth: ["coach"],
  body: createAthleteRequestSchema,
  status: 201,
  response: athleteDetailSchema.extend(invitationResultSchema.shape),
  errors: [409],
  handler: ({ auth, body }) => athleteService.createAthlete(auth.userId, body),
});

athletes.route({
  method: "get",
  path: "/:id",
  summary: "Athlet mit Anamnese abrufen",
  auth: ["coach"],
  params: idParams,
  response: athleteDetailSchema,
  errors: [404],
  handler: ({ auth, params }) => athleteService.getAthlete(auth.userId, params.id),
});

athletes.route({
  method: "patch",
  path: "/:id",
  summary: "Athlet bearbeiten",
  description:
    "`profile` ersetzt die Anamnese vollständig, `permissions` ändert nur die angegebenen " +
    "Berechtigungen (eigener Trainingsplan, eigene Trainingswoche).",
  auth: ["coach"],
  params: idParams,
  body: updateAthleteRequestSchema,
  response: athleteDetailSchema,
  errors: [404],
  handler: ({ auth, params, body }) => athleteService.updateAthlete(auth.userId, params.id, body),
});

athletes.route({
  method: "post",
  path: "/:id/archive",
  summary: "Athlet archivieren",
  description: "Sperrt den Zugang und gibt den Platz im Kontingent frei. Daten bleiben erhalten.",
  auth: ["coach"],
  params: idParams,
  response: athleteDetailSchema,
  errors: [404],
  handler: ({ auth, params }) => athleteService.archiveAthlete(auth.userId, params.id),
});

athletes.route({
  method: "post",
  path: "/:id/reactivate",
  summary: "Athlet reaktivieren",
  auth: ["coach"],
  params: idParams,
  response: athleteDetailSchema,
  errors: [404, 409],
  handler: ({ auth, params }) => athleteService.reactivateAthlete(auth.userId, params.id),
});

athletes.route({
  method: "post",
  path: "/:id/invitation",
  summary: "Einladung erneut senden",
  description: "Der bisherige Link wird ungültig.",
  auth: ["coach"],
  params: idParams,
  response: invitationResultSchema,
  errors: [404, 409, 429],
  middleware: [mailLimiter],
  handler: ({ auth, params }) => athleteService.resendAthleteInvitation(auth.userId, params.id),
});

athletes.route({
  method: "delete",
  path: "/:id",
  summary: "Athlet endgültig löschen",
  description: "Löscht den Athleten und alle zugehörigen Daten unwiderruflich.",
  auth: ["coach"],
  params: idParams,
  status: 204,
  errors: [404],
  handler: async ({ auth, params }) => {
    await athleteService.deleteAthlete(auth.userId, params.id);
  },
});

export const athleteRouter = athletes;

const me = createModuleRouter("/me", "Eigenes Training");

me.route({
  method: "get",
  path: "/permissions",
  summary: "Eigene Berechtigungen",
  description:
    "Was der Coach freigegeben hat: `ownPlan` (Pläne über `/athletes/{eigene ID}/plans` " +
    "verwalten) und `ownWeek` (Wochenplan über `/athletes/{eigene ID}/weekly-activities`).",
  auth: ["athlete"],
  response: athletePermissionsSchema,
  handler: ({ auth }) => athleteService.getMyPermissions(auth.userId),
});

export const myPermissionsRouter = me;
