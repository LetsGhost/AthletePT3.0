import { notificationKinds, type NotificationKind } from "@athletept/shared";
import { Schema, model, type Types } from "mongoose";

/** In-App-Benachrichtigung. Titel und Text werden beim Anlegen fertig formuliert. */
export interface StoredNotification {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  kind: NotificationKind;
  title: string;
  text: string;
  challengeId: Types.ObjectId | null;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    kind: { type: String, enum: notificationKinds, required: true },
    title: { type: String, required: true },
    text: { type: String, required: true },
    challengeId: { type: Schema.Types.ObjectId, ref: "Challenge", default: null },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

notificationSchema.index({ userId: 1, createdAt: -1 });
// Alte Benachrichtigungen räumen sich nach 90 Tagen selbst auf.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const NotificationModel = model("Notification", notificationSchema);
