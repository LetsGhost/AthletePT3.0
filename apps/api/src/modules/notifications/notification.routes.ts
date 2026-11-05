import { notificationListResponseSchema, objectIdSchema } from "@athletept/shared";
import { z } from "zod";

import { createModuleRouter } from "../../lib/router";
import * as notificationService from "./notification.service";

const me = createModuleRouter("/me/notifications", "Benachrichtigungen");

me.route({
  method: "get",
  path: "/",
  summary: "Eigene Benachrichtigungen",
  description: "Die neuesten 50, dazu die Anzahl ungelesener.",
  auth: "any",
  response: notificationListResponseSchema,
  handler: ({ auth }) => notificationService.listMyNotifications(auth.userId),
});

me.route({
  method: "post",
  path: "/read-all",
  summary: "Alle als gelesen markieren",
  auth: "any",
  status: 204,
  handler: async ({ auth }) => {
    await notificationService.markAllRead(auth.userId);
  },
});

me.route({
  method: "post",
  path: "/:id/read",
  summary: "Als gelesen markieren",
  auth: "any",
  params: z.object({ id: objectIdSchema }),
  status: 204,
  errors: [404],
  handler: async ({ auth, params }) => {
    await notificationService.markRead(auth.userId, params.id);
  },
});

export const myNotificationRouter = me;
