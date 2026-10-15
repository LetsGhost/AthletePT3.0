import type { ClientSession, Types } from "mongoose";

import { NotFoundError } from "../../lib/errors";
import { UserModel } from "../users/user.model";

/** Athleten, die auf das Kontingent zählen (archivierte nicht). */
export const COUNTED_ATHLETE_STATUSES = ["invited", "active"] as const;

export function countQuotaAthletes(coachId: Types.ObjectId | string, session?: ClientSession) {
  return UserModel.countDocuments({
    role: "athlete",
    coachId,
    status: { $in: COUNTED_ATHLETE_STATUSES },
  }).session(session ?? null);
}

/**
 * Lädt den Coach innerhalb einer Transaktion und zählt dabei `quotaLock` hoch. Das erzeugt einen
 * Schreibkonflikt zwischen parallelen Transaktionen, die das Kontingent desselben Coaches belegen;
 * MongoDB wiederholt dann eine davon, die anschließend korrekt zählt.
 */
export async function lockCoachQuota(coachId: Types.ObjectId | string, session: ClientSession) {
  const coach = await UserModel.findOneAndUpdate(
    { _id: coachId, role: "coach" },
    { $inc: { quotaLock: 1 } },
    { session, returnDocument: "after" },
  );
  if (!coach) throw new NotFoundError("Coach nicht gefunden");
  return { coach, used: await countQuotaAthletes(coach._id, session) };
}
