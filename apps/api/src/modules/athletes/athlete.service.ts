import type {
  AthleteDetail,
  AthleteListResponse,
  AthletePermissions,
  AthleteProfile,
  AthleteSummary,
  UpdateAthleteRequest,
  UserStatus,
} from "@athletept/shared";
import type { ClientSession } from "mongoose";

import { withTransaction } from "../../lib/db";
import { ConflictError, NotFoundError } from "../../lib/errors";
import { revokeAllSessions } from "../auth/auth.service";
import { COUNTED_ATHLETE_STATUSES, lockCoachQuota } from "../coaches/quota";
import { createInvitationToken, resendInvitation, sendInvitationMail } from "../users/invitations";
import { UserModel, type UserDocument } from "../users/user.model";
import { UserTokenModel } from "../users/user-token.model";
import { getAthleteOfCoach, toPermissionsDto } from "./athlete-access";
import { deleteAllAthleteData } from "./athlete-data";
import {
  AthleteProfileModel,
  toProfileDto,
  type AthleteProfileDocument,
} from "./athlete-profile.model";

type ProfileHeadline = { goal?: string | null; focus?: string | null } | null;

function toSummary(athlete: UserDocument, profile: ProfileHeadline): AthleteSummary {
  return {
    id: athlete._id.toString(),
    name: athlete.name,
    email: athlete.email,
    status: athlete.status,
    goal: profile?.goal || null,
    focus: profile?.focus || null,
    lastLoginAt: athlete.lastLoginAt?.toISOString() ?? null,
    createdAt: athlete.createdAt.toISOString(),
  };
}

function toDetail(athlete: UserDocument, profile: AthleteProfileDocument | null): AthleteDetail {
  return {
    ...toSummary(athlete, profile),
    profile: toProfileDto(profile),
    permissions: toPermissionsDto(athlete),
  };
}

async function getCoach(coachId: string, session?: ClientSession) {
  const coach = await UserModel.findOne({ _id: coachId, role: "coach" }).session(session ?? null);
  if (!coach) throw new NotFoundError("Coach nicht gefunden");
  return coach;
}

/** Prüft innerhalb einer Transaktion, ob noch ein Platz frei ist (siehe `lockCoachQuota`). */
async function reserveQuotaSlot(coachId: string, session: ClientSession) {
  const { coach, used } = await lockCoachQuota(coachId, session);
  if (used >= (coach.athleteQuota ?? 0)) {
    throw new ConflictError(
      `Dein Kontingent von ${coach.athleteQuota ?? 0} Athleten ist ausgeschöpft. Archiviere einen Athleten oder wende dich an den Support.`,
      "quota_exceeded",
    );
  }
}

export async function listAthletes(coachId: string): Promise<AthleteListResponse> {
  const coach = await getCoach(coachId);
  const athletes = await UserModel.find({ role: "athlete", coachId }).sort({ name: 1 });
  const profiles = await AthleteProfileModel.find(
    { athleteId: { $in: athletes.map((a) => a._id) } },
    { athleteId: 1, goal: 1, focus: 1 },
  );
  const byAthlete = new Map(profiles.map((p) => [p.athleteId.toString(), p]));

  return {
    items: athletes.map((a) => toSummary(a, byAthlete.get(a._id.toString()) ?? null)),
    quota: {
      used: athletes.filter((a) =>
        (COUNTED_ATHLETE_STATUSES as readonly UserStatus[]).includes(a.status),
      ).length,
      limit: coach.athleteQuota ?? 0,
    },
  };
}

export async function getAthlete(coachId: string, athleteId: string) {
  const athlete = await getAthleteOfCoach(coachId, athleteId);
  const profile = await AthleteProfileModel.findOne({ athleteId: athlete._id });
  return toDetail(athlete, profile);
}

export async function createAthlete(
  coachId: string,
  input: { email: string; name: string; profile: AthleteProfile },
) {
  const { athlete, profile, token, coachName } = await withTransaction(async (session) => {
    await reserveQuotaSlot(coachId, session);
    if (await UserModel.exists({ email: input.email }).session(session)) {
      throw new ConflictError("Diese E-Mail-Adresse wird bereits verwendet", "email_taken");
    }
    const coach = await getCoach(coachId, session);
    const [athlete] = await UserModel.create(
      [{ email: input.email, name: input.name, role: "athlete", status: "invited", coachId }],
      { session },
    );
    const [profile] = await AthleteProfileModel.create(
      [{ ...input.profile, athleteId: athlete!._id }],
      { session },
    );
    const token = await createInvitationToken(athlete!, session);
    return { athlete: athlete!, profile: profile!, token, coachName: coach.name };
  });

  const inviteSent = await sendInvitationMail(athlete, token, coachName);
  return { ...toDetail(athlete, profile), inviteSent };
}

export async function updateAthlete(
  coachId: string,
  athleteId: string,
  input: UpdateAthleteRequest,
) {
  const athlete = await getAthleteOfCoach(coachId, athleteId);
  if (input.name !== undefined) athlete.name = input.name;
  if (input.permissions !== undefined) {
    athlete.athletePermissions = { ...toPermissionsDto(athlete), ...input.permissions };
  }
  if (athlete.isModified()) await athlete.save();
  let profile = await AthleteProfileModel.findOne({ athleteId: athlete._id });
  if (input.profile !== undefined) {
    // Ersetzen statt mergen: Felder, die im Formular geleert wurden, verschwinden.
    profile = await AthleteProfileModel.findOneAndReplace(
      { athleteId: athlete._id },
      { ...input.profile, athleteId: athlete._id },
      { upsert: true, returnDocument: "after" },
    );
  }
  return toDetail(athlete, profile);
}

/** Berechtigungen des angemeldeten Athleten, damit die Oberfläche passende Aktionen zeigt. */
export async function getMyPermissions(athleteId: string): Promise<AthletePermissions> {
  const athlete = await UserModel.findOne({ _id: athleteId, role: "athlete" });
  if (!athlete) throw new NotFoundError("Athlet nicht gefunden");
  return athlete.coachId ? toPermissionsDto(athlete) : { ownPlan: false, ownWeek: false };
}

/** Archivieren: Zugang sperren, Daten behalten, Platz im Kontingent freigeben. */
export async function archiveAthlete(coachId: string, athleteId: string) {
  const athlete = await getAthleteOfCoach(coachId, athleteId);
  if (athlete.status !== "disabled") {
    athlete.status = "disabled";
    await athlete.save();
    await revokeAllSessions(athlete._id);
    await UserTokenModel.deleteMany({ userId: athlete._id });
  }
  return getAthlete(coachId, athleteId);
}

/**
 * Reaktivieren: belegt wieder einen Platz. Wer die Einladung nie angenommen hat,
 * wird wieder „eingeladen“ und bekommt einen neuen Link.
 */
export async function reactivateAthlete(coachId: string, athleteId: string) {
  const result = await withTransaction(async (session) => {
    const athlete = await getAthleteOfCoach(coachId, athleteId, session);
    if (athlete.status !== "disabled") return { athlete, token: null };

    await reserveQuotaSlot(coachId, session);
    const withPassword = await UserModel.findById(athlete._id)
      .select("+passwordHash")
      .session(session);
    athlete.status = withPassword?.passwordHash ? "active" : "invited";
    await athlete.save({ session });
    const token =
      athlete.status === "invited" ? await createInvitationToken(athlete, session) : null;
    return { athlete, token };
  });

  if (result.token) {
    const coach = await getCoach(coachId);
    await sendInvitationMail(result.athlete, result.token, coach.name);
  }
  return getAthlete(coachId, athleteId);
}

export async function resendAthleteInvitation(coachId: string, athleteId: string) {
  const athlete = await getAthleteOfCoach(coachId, athleteId);
  if (athlete.status !== "invited") {
    throw new ConflictError("Der Athlet hat die Einladung bereits angenommen", "not_invited");
  }
  const coach = await getCoach(coachId);
  return { inviteSent: await resendInvitation(athlete, coach.name) };
}

/** Endgültig löschen, inklusive aller zugehörigen Daten. */
export async function deleteAthlete(coachId: string, athleteId: string) {
  await withTransaction(async (session) => {
    const athlete = await getAthleteOfCoach(coachId, athleteId, session);
    await deleteAllAthleteData(athlete._id, session);
  });
}
