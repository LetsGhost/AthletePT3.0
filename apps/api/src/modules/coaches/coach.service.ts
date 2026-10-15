import type { Coach, CreateCoachRequest, UpdateCoachRequest, UserStatus } from "@athletept/shared";
import type { ClientSession, Types } from "mongoose";

import { withTransaction } from "../../lib/db";
import { AppError, ConflictError, NotFoundError } from "../../lib/errors";
import { logger } from "../../lib/logger/logger";
import { revokeAllSessions } from "../auth/auth.service";
import { createInvitationToken, resendInvitation, sendInvitationMail } from "../users/invitations";
import { UserModel, type UserDocument } from "../users/user.model";
import { UserTokenModel } from "../users/user-token.model";
import { COUNTED_ATHLETE_STATUSES, lockCoachQuota } from "./quota";

interface AthleteCounts {
  counted: number;
  archived: number;
}

const noAthletes: AthleteCounts = { counted: 0, archived: 0 };

function isCounted(status: UserStatus) {
  return (COUNTED_ATHLETE_STATUSES as readonly UserStatus[]).includes(status);
}

function toCoachDto(coach: UserDocument, counts: AthleteCounts): Coach {
  return {
    id: coach._id.toString(),
    email: coach.email,
    name: coach.name,
    status: coach.status,
    athleteQuota: coach.athleteQuota ?? 0,
    athleteCount: counts.counted,
    archivedAthleteCount: counts.archived,
    lastLoginAt: coach.lastLoginAt?.toISOString() ?? null,
    createdAt: coach.createdAt.toISOString(),
  };
}

async function countAthletes(coachIds: Types.ObjectId[]) {
  const rows = await UserModel.aggregate<{ _id: Types.ObjectId; counted: number; total: number }>([
    { $match: { role: "athlete", coachId: { $in: coachIds } } },
    {
      $group: {
        _id: "$coachId",
        counted: { $sum: { $cond: [{ $in: ["$status", COUNTED_ATHLETE_STATUSES] }, 1, 0] } },
        total: { $sum: 1 },
      },
    },
  ]);
  return new Map<string, AthleteCounts>(
    rows.map((row) => [
      row._id.toString(),
      { counted: row.counted, archived: row.total - row.counted },
    ]),
  );
}

async function findCoach(id: string, session?: ClientSession) {
  const coach = await UserModel.findOne({ _id: id, role: "coach" }).session(session ?? null);
  if (!coach) throw new NotFoundError("Coach nicht gefunden");
  return coach;
}

async function withCount(coach: UserDocument) {
  const counts = await countAthletes([coach._id]);
  return toCoachDto(coach, counts.get(coach._id.toString()) ?? noAthletes);
}

export async function listCoaches(): Promise<Coach[]> {
  const coaches = await UserModel.find({ role: "coach" }).sort({ name: 1 });
  const counts = await countAthletes(coaches.map((c) => c._id));
  return coaches.map((coach) => toCoachDto(coach, counts.get(coach._id.toString()) ?? noAthletes));
}

export async function createCoach(input: CreateCoachRequest, inviterName: string) {
  const { coach, token } = await withTransaction(async (session) => {
    if (await UserModel.exists({ email: input.email }).session(session)) {
      throw new ConflictError("Diese E-Mail-Adresse wird bereits verwendet", "email_taken");
    }
    const [created] = await UserModel.create(
      [
        {
          email: input.email,
          name: input.name,
          role: "coach",
          status: "invited",
          athleteQuota: input.athleteQuota,
        },
      ],
      { session },
    );
    const coach = created!;
    return { coach, token: await createInvitationToken(coach, session) };
  });

  const inviteSent = await sendInvitationMail(coach, token, inviterName);
  return { ...toCoachDto(coach, noAthletes), inviteSent };
}

/** Fehler zur Wahl des übernehmenden Coaches. Das Formular zeigt ihn direkt an der Auswahl. */
function reassignmentError(code: string, message: string) {
  return new AppError(409, code, message, [{ path: "reassignToCoachId", message }]);
}

/**
 * Übergibt alle Athleten eines Coaches, der gerade gesperrt wird, an einen anderen aktiven Coach.
 * Archivierte gehen mit, zählen aber nicht aufs Kontingent. Läuft in derselben Transaktion wie die
 * Sperre: Entweder passiert beides oder nichts.
 */
async function reassignAthletes(
  from: UserDocument,
  targetId: string | undefined,
  session: ClientSession,
) {
  const athletes = await UserModel.find({ role: "athlete", coachId: from._id }, { status: 1 })
    .session(session)
    .lean();
  if (athletes.length === 0) return null;

  if (!targetId) {
    throw reassignmentError(
      "reassignment_required",
      `${from.name} betreut noch ${athletes.length} Athleten. Wähle einen Coach, der sie übernimmt.`,
    );
  }
  if (targetId === from._id.toString()) {
    throw reassignmentError(
      "reassignment_invalid",
      "Die Athleten müssen an einen anderen Coach übergeben werden.",
    );
  }

  let locked;
  try {
    locked = await lockCoachQuota(targetId, session);
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw reassignmentError("reassignment_invalid", "Den gewählten Coach gibt es nicht.");
    }
    throw error;
  }
  const { coach: target, used } = locked;
  if (target.status !== "active") {
    throw reassignmentError(
      "reassignment_invalid",
      `${target.name} ist nicht aktiv und kann keine Athleten übernehmen.`,
    );
  }

  const moving = athletes.filter((a) => isCounted(a.status)).length;
  const free = Math.max((target.athleteQuota ?? 0) - used, 0);
  if (moving > free) {
    throw reassignmentError(
      "quota_exceeded",
      `${target.name} hat nur ${free} ${free === 1 ? "freien Platz" : "freie Plätze"}, es kommen aber ${moving} Athleten dazu. Erhöhe zuerst das Kontingent von ${target.name} oder wähle einen anderen Coach.`,
    );
  }

  await UserModel.updateMany(
    { role: "athlete", coachId: from._id },
    { $set: { coachId: target._id } },
    { session },
  );
  return { to: target, count: athletes.length };
}

export async function updateCoach(id: string, input: UpdateCoachRequest) {
  const { coach, reassigned } = await withTransaction(async (session) => {
    const coach = await findCoach(id, session);
    let disabling = false;

    if (input.name !== undefined) coach.name = input.name;
    if (input.athleteQuota !== undefined) coach.athleteQuota = input.athleteQuota;
    if (input.status !== undefined && input.status !== coach.status) {
      if (coach.status === "invited" && input.status === "active") {
        throw new ConflictError(
          "Der Coach hat die Einladung noch nicht angenommen",
          "invitation_pending",
        );
      }
      disabling = input.status === "disabled";
      coach.status = input.status;
    }
    // Sperren schreibt den Coach in dieser Transaktion. Das kollidiert mit einer parallelen
    // Athleten-Anlage durch ihn (`lockCoachQuota`), sodass danach niemand mehr bei ihm landet.
    await coach.save({ session });

    const reassigned = disabling
      ? await reassignAthletes(coach, input.reassignToCoachId, session)
      : null;
    return { coach, reassigned };
  });

  if (reassigned) {
    logger.info("Athleten an anderen Coach übergeben", {
      fromCoachId: coach._id.toString(),
      toCoachId: reassigned.to._id.toString(),
      count: reassigned.count,
    });
  }
  if (coach.status === "disabled") {
    await revokeAllSessions(coach._id);
    await UserTokenModel.deleteMany({ userId: coach._id });
  }
  return withCount(coach);
}

export async function resendCoachInvitation(id: string, inviterName: string) {
  const coach = await findCoach(id);
  if (coach.status !== "invited") {
    throw new ConflictError("Der Coach hat die Einladung bereits angenommen", "not_invited");
  }
  return { inviteSent: await resendInvitation(coach, inviterName) };
}
