import type { AthletePermission, AthletePermissions } from "@athletept/shared";
import type { ClientSession } from "mongoose";

import { ForbiddenError, NotFoundError } from "../../lib/errors";
import type { AuthContext } from "../../types/express";
import { UserModel, type UserDocument } from "../users/user.model";

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

export function toPermissionsDto(athlete: Pick<UserDocument, "athletePermissions">) {
  return {
    ownPlan: athlete.athletePermissions?.ownPlan ?? false,
    ownWeek: athlete.athletePermissions?.ownWeek ?? false,
  } satisfies AthletePermissions;
}

/**
 * Lädt einen Athleten für Coach oder Athlet: Der Coach darf auf seine Athleten zugreifen, der
 * Athlet nur auf sich selbst und nur mit der vom Coach freigegebenen Berechtigung (sonst 403).
 * Alles andere liefert 404 wie `getAthleteOfCoach`.
 */
export async function getAccessibleAthlete(
  auth: AuthContext,
  athleteId: string,
  permission: AthletePermission,
  session?: ClientSession,
) {
  if (auth.role === "coach") return getAthleteOfCoach(auth.userId, athleteId, session);
  if (auth.role === "athlete" && auth.userId === athleteId) {
    const athlete = await UserModel.findOne({ _id: athleteId, role: "athlete" }).session(
      session ?? null,
    );
    // Ohne Coach gibt es niemanden, der die Berechtigung freigegeben hat.
    if (athlete?.coachId && toPermissionsDto(athlete)[permission]) return athlete;
    if (athlete) {
      throw new ForbiddenError(
        "Das hat dein Coach nicht für dich freigegeben.",
        "permission_denied",
      );
    }
  }
  throw new NotFoundError("Athlet nicht gefunden");
}
