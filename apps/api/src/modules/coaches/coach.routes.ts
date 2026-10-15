import {
  coachSchema,
  createCoachRequestSchema,
  invitationResultSchema,
  objectIdSchema,
  updateCoachRequestSchema,
} from "@athletept/shared";
import { z } from "zod";

import { createModuleRouter } from "../../lib/router";
import { mailLimiter } from "../../middleware/rate-limit";
import { UserModel } from "../users/user.model";
import * as coachService from "./coach.service";

const coaches = createModuleRouter("/coaches", "Coaches");
const idParams = z.object({ id: objectIdSchema });

async function actorName(userId: string) {
  return (await UserModel.findById(userId))?.name ?? "AthletePT";
}

coaches.route({
  method: "get",
  path: "/",
  summary: "Alle Coaches auflisten",
  auth: ["sysadmin"],
  response: z.array(coachSchema),
  handler: () => coachService.listCoaches(),
});

coaches.route({
  method: "post",
  path: "/",
  summary: "Coach einladen",
  description: "Legt den Coach an und schickt ihm einen Einladungslink per Mail.",
  auth: ["sysadmin"],
  body: createCoachRequestSchema,
  status: 201,
  response: coachSchema.extend(invitationResultSchema.shape),
  errors: [409, 429],
  middleware: [mailLimiter],
  handler: async ({ auth, body }) => coachService.createCoach(body, await actorName(auth.userId)),
});

coaches.route({
  method: "patch",
  path: "/:id",
  summary: "Coach bearbeiten",
  description:
    "Name, Kontingent oder Status ändern. Sperren meldet den Coach überall ab. Hat er Athleten, " +
    "gehen sie in derselben Transaktion an `reassignToCoachId` (aktiver Coach mit genug freiem " +
    "Kontingent). Fehler: 409 `reassignment_required`, `reassignment_invalid`, `quota_exceeded`.",
  auth: ["sysadmin"],
  params: idParams,
  body: updateCoachRequestSchema,
  response: coachSchema,
  errors: [404, 409],
  handler: ({ params, body }) => coachService.updateCoach(params.id, body),
});

coaches.route({
  method: "post",
  path: "/:id/invitation",
  summary: "Einladung erneut senden",
  description: "Der bisherige Link wird ungültig.",
  auth: ["sysadmin"],
  params: idParams,
  response: invitationResultSchema,
  errors: [404, 409, 429],
  middleware: [mailLimiter],
  handler: async ({ auth, params }) =>
    coachService.resendCoachInvitation(params.id, await actorName(auth.userId)),
});

export const coachRouter = coaches;
