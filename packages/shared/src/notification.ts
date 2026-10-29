import { z } from "zod";

import { challengeKindSchema } from "./challenge";
import { objectIdSchema } from "./common";

/**
 * In-App-Benachrichtigungen (Glocke im Kopf). Bisher nur zu Challenges; neue Arten werden hier
 * ergänzt, die Oberfläche zeigt unbekannte Arten mit einem neutralen Icon.
 */
export const notificationKinds = [
  "duel_invite",
  "duel_accepted",
  "duel_declined",
  "duel_expired",
  "duel_gave_up",
  "challenge_started",
  "challenge_overtaken",
  "challenge_finished",
] as const;
export const notificationKindSchema = z.enum(notificationKinds);
export type NotificationKind = z.infer<typeof notificationKindSchema>;

/** So viele Benachrichtigungen liefert die Liste (neueste zuerst). */
export const NOTIFICATION_LIMIT = 50;

export const notificationSchema = z.object({
  id: objectIdSchema,
  kind: notificationKindSchema,
  title: z.string(),
  text: z.string(),
  challengeId: objectIdSchema.nullable(),
  /** Art der Challenge, für Icon und Farbe. */
  challengeKind: challengeKindSchema.nullable(),
  read: z.boolean(),
  createdAt: z.string(),
});

export const notificationListResponseSchema = z.object({
  items: z.array(notificationSchema),
  unreadCount: z.number().int(),
});

export type Notification = z.infer<typeof notificationSchema>;
export type NotificationListResponse = z.infer<typeof notificationListResponseSchema>;
