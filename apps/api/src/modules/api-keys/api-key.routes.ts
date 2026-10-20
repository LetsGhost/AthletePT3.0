import {
  adminApiKeySchema,
  apiKeyAuditListSchema,
  apiKeyPickupInfoSchema,
  apiKeyPickupLinkResultSchema,
  apiKeyPickupRequestSchema,
  apiKeyPickupResponseSchema,
  apiKeyPickupTokenSchema,
  apiKeySchema,
  createApiKeyRequestSchema,
  objectIdSchema,
  updateApiKeyRequestSchema,
} from "@athletept/shared";
import { z } from "zod";

import { createModuleRouter } from "../../lib/router";
import { credentialsLimiter, mailLimiter } from "../../middleware/rate-limit";
import * as apiKeyService from "./api-key.service";

// Keine dieser Routen hat einen `apiKeyScope`: Keys lassen sich nie mit einem Key verwalten.
const apiKeys = createModuleRouter("/api-keys", "API-Keys");
const idParams = z.object({ id: objectIdSchema });

apiKeys.route({
  method: "get",
  path: "/",
  summary: "Alle API-Keys auflisten",
  description: "Mit Nutzer und Nutzung, neueste zuerst. Den Key selbst kennt nur der Nutzer.",
  auth: ["sysadmin"],
  response: z.array(adminApiKeySchema),
  handler: () => apiKeyService.listApiKeys(),
});

apiKeys.route({
  method: "post",
  path: "/",
  summary: "API-Key anlegen",
  description:
    "Für den Coach oder Athleten mit der E-Mail. Der Nutzer bekommt einen Abhol-Link per Mail; " +
    "erst beim Abholen entsteht der Key. Fehler: 404 (kein Coach/Athlet), 409 " +
    "`api_key_limit_reached`, 400 `api_key_scope_invalid`, `api_key_user_disabled`.",
  auth: ["sysadmin"],
  body: createApiKeyRequestSchema,
  status: 201,
  response: adminApiKeySchema.extend(apiKeyPickupLinkResultSchema.shape),
  errors: [404, 409, 429],
  middleware: [mailLimiter],
  handler: ({ auth, body }) => apiKeyService.createApiKeyForEmail(auth, body),
});

apiKeys.route({
  method: "patch",
  path: "/:id",
  summary: "API-Key ändern",
  description:
    "Name, Rate-Limit oder Bereiche. Bereiche lassen sich nur einschränken (sonst 400 " +
    "`api_key_scope_extension`).",
  auth: ["sysadmin"],
  params: idParams,
  body: updateApiKeyRequestSchema,
  response: adminApiKeySchema,
  errors: [404],
  handler: ({ params, body }) => apiKeyService.updateApiKey(params.id, body),
});

apiKeys.route({
  method: "post",
  path: "/:id/revoke",
  summary: "API-Key zurückziehen",
  description: "Wirkt sofort.",
  auth: ["sysadmin"],
  params: idParams,
  response: adminApiKeySchema,
  errors: [404],
  handler: async ({ auth, params }) => {
    await apiKeyService.revokeApiKey(params.id, auth.userId);
    return apiKeyService.getAdminApiKey(params.id);
  },
});

apiKeys.route({
  method: "post",
  path: "/:id/pickup-link",
  summary: "Abhol-Link erneut senden",
  description:
    "Nur für nicht abgeholte Keys (sonst 409 `api_key_not_pending`). Der alte Link wird ungültig.",
  auth: ["sysadmin"],
  params: idParams,
  response: apiKeyPickupLinkResultSchema,
  errors: [409, 429],
  middleware: [mailLimiter],
  handler: ({ params }) => apiKeyService.sendPickupLink(params.id),
});

apiKeys.route({
  method: "get",
  path: "/:id/audit",
  summary: "Schreibzugriffe eines API-Keys",
  description:
    "Die letzten 100, nur Methode, Pfad und Status. Einträge werden nach 90 Tagen gelöscht.",
  auth: ["sysadmin"],
  params: idParams,
  response: apiKeyAuditListSchema,
  errors: [404],
  handler: ({ params }) => apiKeyService.listAudit(params.id),
});

apiKeys.route({
  method: "post",
  path: "/pickup/inspect",
  summary: "Abhol-Link prüfen",
  description:
    "Nur für den angemeldeten Nutzer, dem der Key gehört (sonst 403 `api_key_pickup_wrong_user`).",
  auth: ["coach", "athlete"],
  body: apiKeyPickupTokenSchema,
  response: apiKeyPickupInfoSchema,
  middleware: [credentialsLimiter],
  handler: ({ auth, body }) => apiKeyService.inspectPickup(auth, body.token),
});

apiKeys.route({
  method: "post",
  path: "/pickup",
  summary: "API-Key abholen",
  description:
    "Bestätigt den Datenzugriff der App und liefert den Key genau einmal im Klartext. Der Link " +
    "ist danach verbraucht.",
  auth: ["coach", "athlete"],
  body: apiKeyPickupRequestSchema,
  response: apiKeyPickupResponseSchema,
  middleware: [credentialsLimiter],
  handler: ({ auth, body }) => apiKeyService.pickUpApiKey(auth, body.token),
});

export const apiKeyRouter = apiKeys;

const me = createModuleRouter("/me", "API-Keys");

me.route({
  method: "get",
  path: "/api-keys",
  summary: "Eigene API-Keys",
  auth: ["coach", "athlete"],
  response: z.array(apiKeySchema),
  handler: ({ auth }) => apiKeyService.listMyApiKeys(auth.userId),
});

me.route({
  method: "post",
  path: "/api-keys/:id/revoke",
  summary: "Eigenen API-Key zurückziehen",
  description: "Wirkt sofort, z. B. wenn das Gerät mit der App verloren ging.",
  auth: ["coach", "athlete"],
  params: idParams,
  response: apiKeySchema,
  errors: [404],
  handler: ({ auth, params }) => apiKeyService.revokeMyApiKey(auth, params.id),
});

export const myApiKeyRouter = me;
