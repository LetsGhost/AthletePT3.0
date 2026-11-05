import {
  NOTIFICATION_LIMIT,
  type NotificationKind,
  type NotificationListResponse,
} from "@athletept/shared";
import { type Types } from "mongoose";

import { NotFoundError } from "../../lib/errors";
import { ChallengeModel } from "../challenges/challenge.model";
import { NotificationModel, type StoredNotification } from "./notification.model";

export interface NewNotification {
  userId: Types.ObjectId | string;
  kind: NotificationKind;
  title: string;
  text: string;
  challengeId?: Types.ObjectId | string | null;
}

/** Legt Benachrichtigungen an. Fehler hier dürfen die auslösende Aktion nicht scheitern lassen. */
export async function notify(notifications: readonly NewNotification[]) {
  if (notifications.length === 0) return;
  await NotificationModel.insertMany(
    notifications.map((n) => ({ ...n, challengeId: n.challengeId ?? null })),
  );
}

export async function listMyNotifications(userId: string): Promise<NotificationListResponse> {
  const [items, unreadCount] = await Promise.all([
    NotificationModel.find({ userId })
      .sort({ createdAt: -1, _id: -1 })
      .limit(NOTIFICATION_LIMIT)
      .lean<StoredNotification[]>(),
    NotificationModel.countDocuments({ userId, readAt: null }),
  ]);
  const challengeIds = [...new Set(items.flatMap((n) => (n.challengeId ? [n.challengeId] : [])))];
  const challenges = await ChallengeModel.find({ _id: { $in: challengeIds } }, { kind: 1 }).lean<
    { _id: Types.ObjectId; kind: "coach" | "duel" | "system" }[]
  >();
  const kinds = new Map(challenges.map((c) => [c._id.toString(), c.kind]));
  return {
    items: items.map((n) => ({
      id: n._id.toString(),
      kind: n.kind,
      title: n.title,
      text: n.text,
      // Gelöschte Challenges (z. B. geplante, die der Coach entfernt hat) verlinken nicht mehr.
      challengeId:
        n.challengeId && kinds.has(n.challengeId.toString()) ? n.challengeId.toString() : null,
      challengeKind: n.challengeId ? (kinds.get(n.challengeId.toString()) ?? null) : null,
      read: n.readAt !== null,
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount,
  };
}

export async function markRead(userId: string, id: string) {
  const result = await NotificationModel.updateOne(
    { _id: id, userId },
    { $set: { readAt: new Date() } },
  );
  if (result.matchedCount === 0) throw new NotFoundError("Benachrichtigung nicht gefunden");
}

export async function markAllRead(userId: string) {
  await NotificationModel.updateMany({ userId, readAt: null }, { $set: { readAt: new Date() } });
}
