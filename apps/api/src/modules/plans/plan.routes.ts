import {
  createPlanRequestSchema,
  myPlanResponseSchema,
  objectIdSchema,
  planListResponseSchema,
  planSchema,
  planTemplateListResponseSchema,
  planTemplateSchema,
  planVersionListResponseSchema,
  planVersionSchema,
  updatePlanRequestSchema,
} from "@athletept/shared";
import { z } from "zod";

import { createModuleRouter } from "../../lib/router";
import * as templateService from "./plan-template.service";
import * as planService from "./plan.service";

// Pläne hängen am Athleten: /athletes/:athleteId/plans (Owner-Prüfung über den Athleten).
// Athleten mit der Berechtigung `ownPlan` nutzen dieselben Routen mit ihrer eigenen ID.
const plans = createModuleRouter("/athletes", "Trainingspläne");
const roles = ["coach", "athlete"] as const;
const athleteParams = z.object({ athleteId: objectIdSchema });
const planParams = athleteParams.extend({ planId: objectIdSchema });

plans.route({
  method: "get",
  path: "/:athleteId/plans",
  summary: "Pläne eines Athleten auflisten",
  description: "Aktiver Plan zuerst, dann Entwürfe, dann archivierte.",
  auth: roles,
  apiKeyScope: "plans:read",
  params: athleteParams,
  response: planListResponseSchema,
  errors: [404],
  handler: ({ auth, params }) => planService.listPlans(auth, params.athleteId),
});

plans.route({
  method: "post",
  path: "/:athleteId/plans",
  summary: "Plan anlegen",
  description:
    "Legt einen Entwurf an. Übungen müssen für den Coach sichtbar und aktiv sein (bei Athleten: " +
    "für ihren Coach). Übungsnamen und Plan-Typ setzt der Server.",
  auth: roles,
  apiKeyScope: "plans:write",
  params: athleteParams,
  body: createPlanRequestSchema,
  status: 201,
  response: planSchema,
  errors: [404],
  handler: ({ auth, params, body }) => planService.createPlan(auth, params.athleteId, body),
});

plans.route({
  method: "get",
  path: "/:athleteId/plans/:planId",
  summary: "Plan abrufen",
  description: "Inklusive Details aller verwendeten Übungen (`exercises`).",
  auth: roles,
  apiKeyScope: "plans:read",
  params: planParams,
  response: planSchema,
  errors: [404],
  handler: ({ auth, params }) => planService.getPlan(auth, params.athleteId, params.planId),
});

plans.route({
  method: "put",
  path: "/:athleteId/plans/:planId",
  summary: "Plan speichern",
  description:
    "Ersetzt den Inhalt. `revision` muss dem zuletzt geladenen Stand entsprechen, sonst 409 " +
    "`plan_conflict`. Bei aktiven Plänen wird der bisherige Stand als Version gesichert. " +
    "Archivierte Pläne: 409 `plan_archived`.",
  auth: roles,
  apiKeyScope: "plans:write",
  params: planParams,
  body: updatePlanRequestSchema,
  response: planSchema,
  errors: [404, 409],
  handler: ({ auth, params, body }) =>
    planService.updatePlan(auth, params.athleteId, params.planId, body),
});

plans.route({
  method: "post",
  path: "/:athleteId/plans/:planId/activate",
  summary: "Plan aktivieren",
  description:
    "Gibt den Plan für den Athleten frei und archiviert den bisher aktiven. Unvollständige " +
    "Pläne: 400 `plan_incomplete`.",
  auth: roles,
  apiKeyScope: "plans:write",
  params: planParams,
  response: planSchema,
  errors: [404],
  handler: ({ auth, params }) => planService.activatePlan(auth, params.athleteId, params.planId),
});

plans.route({
  method: "post",
  path: "/:athleteId/plans/:planId/archive",
  summary: "Plan archivieren",
  auth: roles,
  apiKeyScope: "plans:write",
  params: planParams,
  response: planSchema,
  errors: [404],
  handler: ({ auth, params }) => planService.archivePlan(auth, params.athleteId, params.planId),
});

plans.route({
  method: "delete",
  path: "/:athleteId/plans/:planId",
  summary: "Entwurf löschen",
  description: "Nur Entwürfe, sonst 409 `plan_not_draft`.",
  auth: roles,
  apiKeyScope: "plans:write",
  params: planParams,
  status: 204,
  errors: [404, 409],
  handler: async ({ auth, params }) => {
    await planService.deletePlan(auth, params.athleteId, params.planId);
  },
});

plans.route({
  method: "get",
  path: "/:athleteId/plans/:planId/versions",
  summary: "Frühere Versionen eines Plans",
  auth: roles,
  apiKeyScope: "plans:read",
  params: planParams,
  response: planVersionListResponseSchema,
  errors: [404],
  handler: ({ auth, params }) => planService.listVersions(auth, params.athleteId, params.planId),
});

plans.route({
  method: "get",
  path: "/:athleteId/plans/:planId/versions/:revision",
  summary: "Frühere Version abrufen",
  auth: roles,
  apiKeyScope: "plans:read",
  params: planParams.extend({ revision: z.coerce.number().int().min(0) }),
  response: planVersionSchema,
  errors: [404],
  handler: ({ auth, params }) =>
    planService.getVersion(auth, params.athleteId, params.planId, params.revision),
});

export const planRouter = plans;

const me = createModuleRouter("/me", "Eigenes Training");

me.route({
  method: "get",
  path: "/plan",
  summary: "Eigenen aktiven Plan abrufen",
  description:
    "Aktiver Plan des angemeldeten Athleten mit Details der verwendeten Übungen, `plan: null`, " +
    "solange es keinen gibt.",
  auth: ["athlete"],
  apiKeyScope: "plans:read",
  response: myPlanResponseSchema,
  handler: ({ auth }) => planService.getMyPlan(auth.userId),
});

export const myPlanRouter = me;

const templates = createModuleRouter("/plan-templates", "Planvorlagen");
const templateParams = z.object({ id: objectIdSchema });

templates.route({
  method: "get",
  path: "/",
  summary: "Eigene Vorlagen auflisten",
  auth: ["coach"],
  apiKeyScope: "plans:read",
  response: planTemplateListResponseSchema,
  handler: ({ auth }) => templateService.listTemplates(auth.userId),
});

templates.route({
  method: "post",
  path: "/",
  summary: "Vorlage anlegen",
  auth: ["coach"],
  apiKeyScope: "plans:write",
  body: createPlanRequestSchema,
  status: 201,
  response: planTemplateSchema,
  handler: ({ auth, body }) => templateService.createTemplate(auth.userId, body),
});

templates.route({
  method: "get",
  path: "/:id",
  summary: "Vorlage abrufen",
  auth: ["coach"],
  apiKeyScope: "plans:read",
  params: templateParams,
  response: planTemplateSchema,
  errors: [404],
  handler: ({ auth, params }) => templateService.getTemplate(auth.userId, params.id),
});

templates.route({
  method: "put",
  path: "/:id",
  summary: "Vorlage speichern",
  description: "Wie beim Plan: `revision` mitschicken, sonst 409 `plan_conflict`.",
  auth: ["coach"],
  apiKeyScope: "plans:write",
  params: templateParams,
  body: updatePlanRequestSchema,
  response: planTemplateSchema,
  errors: [404, 409],
  handler: ({ auth, params, body }) => templateService.updateTemplate(auth.userId, params.id, body),
});

templates.route({
  method: "delete",
  path: "/:id",
  summary: "Vorlage löschen",
  description: "Pläne, die aus der Vorlage entstanden sind, bleiben erhalten.",
  auth: ["coach"],
  apiKeyScope: "plans:write",
  params: templateParams,
  status: 204,
  errors: [404],
  handler: async ({ auth, params }) => {
    await templateService.deleteTemplate(auth.userId, params.id);
  },
});

export const planTemplateRouter = templates;
