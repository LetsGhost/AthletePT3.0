import type { ClientSession } from "mongoose";

import { NotFoundError } from "../../lib/errors";
import { UserModel } from "../users/user.model";

/**
 * Lädt einen Athleten, sofern er zum Coach gehört. Fremde und nicht existierende Athleten
 * liefern beide 404, damit sich nicht herausfinden lässt, welche IDs existieren.
 *
 * Zentrale Stelle für die Owner-Prüfung: Jedes Modul, das Athletendaten für Coaches
 * ausliefert, muss hierüber gehen.
 */
export async function getAthleteOfCoach(
  coachId: string,
  athleteId: string,
  session?: ClientSession,
) {
  const athlete = await UserModel.findOne({ _id: athleteId, role: "athlete", coachId }).session(
    session ?? null,
  );
  if (!athlete) {
    throw new NotFoundError("Athlet nicht gefunden");
  }
  return athlete;
}
