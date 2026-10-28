import {
  addDays,
  isoWeekOf,
  isoWeekStart,
  todayIsoDate,
  type ChallengeListResponse,
  type createSystemTemplateRequestSchema,
  type SystemTemplate,
  type SystemTemplateListResponse,
  type updateSystemTemplateRequestSchema,
} from "@athletept/shared";
import { Types } from "mongoose";
import type { z } from "zod";

import { BadRequestError, ConflictError, NotFoundError } from "../../lib/errors";
import { UserModel } from "../users/user.model";
import {
  athletePerspective,
  buildDetail,
  sortForList,
  statusOf,
  toSummary,
} from "./challenge-view";
import { ChallengeModel, type StoredChallenge } from "./challenge.model";
import { SystemTemplateModel, type StoredSystemTemplate } from "./system-template.model";

type CreateInput = z.output<typeof createSystemTemplateRequestSchema>;
type UpdateInput = z.output<typeof updateSystemTemplateRequestSchema>;

const monthName = new Intl.DateTimeFormat("de-DE", { month: "long", timeZone: "UTC" });

function monthBounds(date: string) {
  const [year, month] = date.split("-").map(Number);
  const start = `${date.slice(0, 7)}-01`;
  const next =
    month === 12 ? `${year! + 1}-01-01` : `${year}-${String(month! + 1).padStart(2, "0")}-01`;
  return { startDate: start, endDate: addDays(next, -1) };
}

/** Runde, die `date` enthält. Einmalige Vorlagen haben genau eine. */
export function roundAt(
  template: Pick<StoredSystemTemplate, "rhythm" | "startDate" | "endDate">,
  date: string,
) {
  if (template.rhythm === "weekly") {
    const startDate = isoWeekStart(isoWeekOf(date));
    return { startDate, endDate: addDays(startDate, 6) };
  }
  if (template.rhythm === "monthly") return monthBounds(date);
  return { startDate: template.startDate!, endDate: template.endDate! };
}

export function roundTitle(
  template: Pick<StoredSystemTemplate, "title" | "rhythm">,
  startDate: string,
) {
  if (template.rhythm === "weekly")
    return `${template.title} · KW ${Number(isoWeekOf(startDate).slice(6))}`;
  if (template.rhythm === "monthly") {
    return `${template.title} · ${monthName.format(new Date(`${startDate}T00:00:00Z`))}`;
  }
  return template.title;
}

/** Legt eine Runde an, falls es sie noch nicht gibt (idempotent, auch bei parallelen Läufen). */
async function ensureRound(
  template: StoredSystemTemplate,
  round: { startDate: string; endDate: string },
) {
  await ChallengeModel.updateOne(
    { templateId: template._id, startDate: round.startDate },
    {
      $setOnInsert: {
        kind: "system",
        templateId: template._id,
        title: roundTitle(template, round.startDate),
        description: template.description,
        metric: template.metric,
        // Gewertet als Ziel: Bronze geschafft. Die Rangliste ergibt sich trotzdem.
        scoring: "goal",
        goalValue: template.tiers[0],
        tiers: template.tiers,
        startDate: round.startDate,
        endDate: round.endDate,
        participantIds: [],
      },
    },
    { upsert: true },
  );
}

/**
 * Für jede aktive Vorlage die laufende und die nächste Runde, damit Athleten schon vorab
 * beitreten können. Einmalige Events nur, solange sie nicht vorbei sind.
 */
export async function ensureSystemRounds(today = todayIsoDate(), templateId?: Types.ObjectId) {
  const templates = await SystemTemplateModel.find({
    status: "active",
    ...(templateId ? { _id: templateId } : {}),
  }).lean<StoredSystemTemplate[]>();
  for (const template of templates) {
    if (template.rhythm === "once") {
      if (template.endDate! >= today) await ensureRound(template, roundAt(template, today));
      continue;
    }
    const current = roundAt(template, today);
    await ensureRound(template, current);
    await ensureRound(template, roundAt(template, addDays(current.endDate, 1)));
  }
}

async function toTemplateDto(
  template: StoredSystemTemplate,
  rounds: StoredChallenge[],
  today: string,
): Promise<SystemTemplate> {
  const own = rounds
    .filter((r) => r.templateId?.equals(template._id))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const current =
    own.find((r) => statusOf(r, today) === "running") ??
    own.find((r) => statusOf(r, today) === "planned") ??
    null;
  const recurring = template.rhythm !== "once" && template.status === "active";
  return {
    id: template._id.toString(),
    title: template.title,
    description: template.description,
    metric: template.metric,
    tiers: template.tiers,
    rhythm: template.rhythm,
    startDate: template.startDate,
    endDate: template.endDate,
    status: template.status,
    currentRound: current
      ? {
          id: current._id.toString(),
          startDate: current.startDate,
          endDate: current.endDate,
          status: statusOf(current, today),
          participantCount: current.participantIds.length,
        }
      : null,
    nextRoundStart: recurring ? addDays(roundAt(template, today).endDate, 1) : null,
    roundCount: own.length,
  };
}

export async function listTemplates(): Promise<SystemTemplateListResponse> {
  const today = todayIsoDate();
  const [templates, rounds] = await Promise.all([
    SystemTemplateModel.find().sort({ createdAt: -1 }).lean<StoredSystemTemplate[]>(),
    ChallengeModel.find(
      { kind: "system" },
      { templateId: 1, startDate: 1, endDate: 1, endedEarly: 1, participantIds: 1, kind: 1 },
    ).lean<StoredChallenge[]>(),
  ]);
  const running = rounds.filter((r) => statusOf(r, today) === "running");
  const activeParticipants = new Set(running.flatMap((r) => r.participantIds.map(String))).size;
  return {
    items: await Promise.all(templates.map((t) => toTemplateDto(t, rounds, today))),
    activeParticipants,
  };
}

async function templateDto(id: Types.ObjectId | string) {
  const today = todayIsoDate();
  const template = await SystemTemplateModel.findById(id).lean<StoredSystemTemplate>();
  if (!template) throw new NotFoundError("Vorlage nicht gefunden");
  const rounds = await ChallengeModel.find({ templateId: template._id }).lean<StoredChallenge[]>();
  return toTemplateDto(template, rounds, today);
}

export async function createTemplate(input: CreateInput) {
  const today = todayIsoDate();
  if (input.rhythm === "once" && input.startDate! < today) {
    throw new BadRequestError("Der Start darf nicht in der Vergangenheit liegen.", "start_in_past");
  }
  const created = await SystemTemplateModel.create({
    ...input,
    startDate: input.rhythm === "once" ? input.startDate : null,
    endDate: input.rhythm === "once" ? input.endDate : null,
  });
  if (input.status === "active") await ensureSystemRounds(today, created._id);
  return templateDto(created._id);
}

/** Änderungen gelten ab der nächsten Runde. Pausieren lässt laufende Runden regulär enden. */
export async function updateTemplate(id: string, input: UpdateInput) {
  const template = await SystemTemplateModel.findById(id).lean<StoredSystemTemplate>();
  if (!template) throw new NotFoundError("Vorlage nicht gefunden");
  if (input.status === "draft" && template.status !== "draft") {
    throw new ConflictError(
      "Eine veröffentlichte Vorlage wird nicht wieder zum Entwurf.",
      "template_published",
    );
  }
  await SystemTemplateModel.updateOne({ _id: template._id }, { $set: input });
  // Geplante Runden ohne Teilnehmer übernehmen die neuen Werte, laufende bleiben, wie sie sind.
  const today = todayIsoDate();
  const updated = { ...template, ...input } as StoredSystemTemplate;
  const planned = await ChallengeModel.find({
    templateId: template._id,
    startDate: { $gt: today },
  }).lean<StoredChallenge[]>();
  for (const round of planned) {
    await ChallengeModel.updateOne(
      { _id: round._id },
      {
        $set: {
          title: roundTitle(updated, round.startDate),
          description: updated.description,
          tiers: updated.tiers,
          goalValue: updated.tiers[0],
        },
      },
    );
  }
  if (updated.status === "active") await ensureSystemRounds(today, template._id);
  return templateDto(template._id);
}

/** Nur Entwürfe, veröffentlichte Vorlagen werden pausiert. */
export async function deleteTemplate(id: string) {
  const template = await SystemTemplateModel.findById(id).lean<StoredSystemTemplate>();
  if (!template) throw new NotFoundError("Vorlage nicht gefunden");
  if (template.status !== "draft") {
    throw new ConflictError(
      "Veröffentlichte Vorlagen lassen sich nur pausieren.",
      "template_published",
    );
  }
  await SystemTemplateModel.deleteOne({ _id: template._id });
}

// ---------------------------------------------------------------------------------------------
// Athlet

/** System-Runden, die laufen oder bald starten und bei denen der Athlet noch nicht dabei ist. */
export async function listDiscover(athleteId: string): Promise<ChallengeListResponse> {
  const today = todayIsoDate();
  const rounds = await ChallengeModel.find({
    kind: "system",
    endDate: { $gte: today },
    endedEarly: false,
    participantIds: { $ne: new Types.ObjectId(athleteId) },
  }).lean<StoredChallenge[]>();
  const perspective = await athletePerspective(athleteId);
  const details = await Promise.all(rounds.map((r) => buildDetail(r, perspective)));
  return { items: sortForList(details.map(toSummary)) };
}

async function findRound(id: string) {
  const round = await ChallengeModel.findOne({ _id: id, kind: "system" }).lean<StoredChallenge>();
  if (!round) throw new NotFoundError("Challenge nicht gefunden");
  if (statusOf(round, todayIsoDate()) === "finished") {
    throw new ConflictError("Die Challenge ist bereits beendet.", "challenge_finished");
  }
  return round;
}

/** Beitreten geht vor und während der Runde, nur mit Spitznamen (für die globale Rangliste). */
export async function joinRound(athleteId: string, id: string) {
  const round = await findRound(id);
  const athlete = await UserModel.findById(athleteId, { nickname: 1 }).lean<{
    nickname?: string | null;
  }>();
  if (!athlete?.nickname) {
    throw new ConflictError("Wähle zuerst einen Spitznamen.", "nickname_required");
  }
  const updated = await ChallengeModel.findByIdAndUpdate(
    round._id,
    { $addToSet: { participantIds: new Types.ObjectId(athleteId) } },
    { returnDocument: "after" },
  ).lean<StoredChallenge>();
  return buildDetail(updated!, await athletePerspective(athleteId));
}

export async function leaveRound(athleteId: string, id: string) {
  const round = await findRound(id);
  const updated = await ChallengeModel.findByIdAndUpdate(
    round._id,
    { $pull: { participantIds: new Types.ObjectId(athleteId) } },
    { returnDocument: "after" },
  ).lean<StoredChallenge>();
  return buildDetail(updated!, await athletePerspective(athleteId));
}
