import type {
  MyPlanResponse,
  Plan,
  PlanListResponse,
  PlanStatus,
  PlanSummary,
  PlanVersion,
  PlanVersionListResponse,
  createPlanRequestSchema,
  updatePlanRequestSchema,
} from "@athletept/shared";
import type { ClientSession } from "mongoose";
import type { z } from "zod";

import { withTransaction } from "../../lib/db";
import { ConflictError, NotFoundError } from "../../lib/errors";
import { getAthleteOfCoach } from "../athletes/athlete-access";
import { assertComplete, buildContent, toContentDto } from "./plan-content";
import {
  TrainingPlanModel,
  TrainingPlanVersionModel,
  type StoredPlan,
  type StoredPlanVersion,
} from "./plan.model";

type CreateInput = z.output<typeof createPlanRequestSchema>;
type UpdateInput = z.output<typeof updatePlanRequestSchema>;

async function toPlanDto(plan: StoredPlan, coachId: string | null): Promise<Plan> {
  return {
    id: plan._id.toString(),
    athleteId: plan.athleteId.toString(),
    status: plan.status,
    ...(await toContentDto(plan, coachId)),
    activatedAt: plan.activatedAt?.toISOString() ?? null,
    archivedAt: plan.archivedAt?.toISOString() ?? null,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

function toSummary(plan: StoredPlan): PlanSummary {
  return {
    id: plan._id.toString(),
    name: plan.name,
    status: plan.status,
    type: plan.type,
    dayCount: plan.days.length,
    activatedAt: plan.activatedAt?.toISOString() ?? null,
    archivedAt: plan.archivedAt?.toISOString() ?? null,
    updatedAt: plan.updatedAt.toISOString(),
  };
}

/** Lädt einen Plan, sofern der Athlet zum Coach gehört. Sonst 404. */
async function findPlan(
  coachId: string,
  athleteId: string,
  planId: string,
  session?: ClientSession,
) {
  await getAthleteOfCoach(coachId, athleteId, session);
  const plan = await TrainingPlanModel.findOne({ _id: planId, athleteId })
    .session(session ?? null)
    .lean<StoredPlan>();
  if (!plan) throw new NotFoundError("Plan nicht gefunden");
  return plan;
}

async function reload(planId: StoredPlan["_id"], session?: ClientSession) {
  const plan = await TrainingPlanModel.findById(planId)
    .session(session ?? null)
    .lean<StoredPlan>();
  if (!plan) throw new NotFoundError("Plan nicht gefunden");
  return plan;
}

const statusOrder: Record<PlanStatus, number> = { active: 0, draft: 1, archived: 2 };

export async function listPlans(coachId: string, athleteId: string): Promise<PlanListResponse> {
  await getAthleteOfCoach(coachId, athleteId);
  const plans = await TrainingPlanModel.find({ athleteId }).lean<StoredPlan[]>();
  plans.sort(
    (a, b) =>
      statusOrder[a.status] - statusOrder[b.status] ||
      b.updatedAt.getTime() - a.updatedAt.getTime(),
  );
  return { items: plans.map(toSummary) };
}

export async function getPlan(coachId: string, athleteId: string, planId: string) {
  return toPlanDto(await findPlan(coachId, athleteId, planId), coachId);
}

/** Neue Pläne sind Entwürfe. Der Athlet sieht sie erst nach dem Aktivieren. */
export async function createPlan(coachId: string, athleteId: string, input: CreateInput) {
  await getAthleteOfCoach(coachId, athleteId);
  const content = await buildContent(coachId, input, null);
  const created = await TrainingPlanModel.create({
    athleteId,
    createdByCoachId: coachId,
    status: "draft",
    revision: 0,
    ...content,
  });
  return toPlanDto(await reload(created._id), coachId);
}

function planConflict() {
  return new ConflictError(
    "Der Plan wurde inzwischen geändert. Lade ihn neu, um die aktuelle Fassung zu sehen.",
    "plan_conflict",
  );
}

/**
 * Ersetzt den Inhalt. Bei einem aktiven Plan wird der bisherige Stand vorher als Version
 * gesichert. Archivierte Pläne sind schreibgeschützt.
 */
export async function updatePlan(
  coachId: string,
  athleteId: string,
  planId: string,
  input: UpdateInput,
) {
  const updated = await withTransaction(async (session) => {
    const plan = await findPlan(coachId, athleteId, planId, session);
    if (plan.status === "archived") {
      throw new ConflictError(
        "Archivierte Pläne lassen sich nicht bearbeiten. Dupliziere ihn, um darauf aufzubauen.",
        "plan_archived",
      );
    }
    if (plan.revision !== input.revision) throw planConflict();

    const content = await buildContent(coachId, input, plan, session);
    if (plan.status === "active") {
      assertComplete(content);
      await TrainingPlanVersionModel.create(
        [
          {
            planId: plan._id,
            athleteId: plan.athleteId,
            name: plan.name,
            notes: plan.notes,
            type: plan.type,
            revision: plan.revision,
            days: plan.days,
            replacedAt: new Date(),
            replacedByCoachId: coachId,
          },
        ],
        { session },
      );
    }
    const result = await TrainingPlanModel.updateOne(
      { _id: plan._id, revision: input.revision },
      { $set: content, $inc: { revision: 1 } },
      { session },
    );
    if (result.matchedCount === 0) throw planConflict();
    return reload(plan._id, session);
  });
  return toPlanDto(updated, coachId);
}

/** Gibt den Plan für den Athleten frei. Der bisher aktive Plan wird archiviert. */
export async function activatePlan(coachId: string, athleteId: string, planId: string) {
  const activated = await withTransaction(async (session) => {
    const plan = await findPlan(coachId, athleteId, planId, session);
    if (plan.status === "active") return plan;
    assertComplete(plan);
    const now = new Date();
    await TrainingPlanModel.updateMany(
      { athleteId: plan.athleteId, status: "active" },
      { $set: { status: "archived", archivedAt: now }, $inc: { revision: 1 } },
      { session },
    );
    await TrainingPlanModel.updateOne(
      { _id: plan._id },
      { $set: { status: "active", activatedAt: now, archivedAt: null }, $inc: { revision: 1 } },
      { session },
    );
    return reload(plan._id, session);
  });
  return toPlanDto(activated, coachId);
}

/** Archivierte Pläne sieht der Athlet nicht mehr. Sie bleiben für die Historie erhalten. */
export async function archivePlan(coachId: string, athleteId: string, planId: string) {
  const plan = await findPlan(coachId, athleteId, planId);
  if (plan.status !== "archived") {
    await TrainingPlanModel.updateOne(
      { _id: plan._id },
      { $set: { status: "archived", archivedAt: new Date() }, $inc: { revision: 1 } },
    );
  }
  return toPlanDto(await reload(plan._id), coachId);
}

/** Nur Entwürfe lassen sich löschen; alles, was der Athlet gesehen hat, wird archiviert. */
export async function deletePlan(coachId: string, athleteId: string, planId: string) {
  const plan = await findPlan(coachId, athleteId, planId);
  if (plan.status !== "draft") {
    throw new ConflictError(
      "Nur Entwürfe lassen sich löschen. Archiviere den Plan stattdessen.",
      "plan_not_draft",
    );
  }
  await TrainingPlanModel.deleteOne({ _id: plan._id });
}

export async function listVersions(
  coachId: string,
  athleteId: string,
  planId: string,
): Promise<PlanVersionListResponse> {
  const plan = await findPlan(coachId, athleteId, planId);
  const versions = await TrainingPlanVersionModel.find({ planId: plan._id })
    .sort({ revision: -1 })
    .lean<StoredPlanVersion[]>();
  return {
    items: versions.map((version) => ({
      revision: version.revision,
      name: version.name,
      dayCount: version.days.length,
      replacedAt: version.replacedAt.toISOString(),
    })),
  };
}

export async function getVersion(
  coachId: string,
  athleteId: string,
  planId: string,
  revision: number,
): Promise<PlanVersion> {
  const plan = await findPlan(coachId, athleteId, planId);
  const version = await TrainingPlanVersionModel.findOne({
    planId: plan._id,
    revision,
  }).lean<StoredPlanVersion>();
  if (!version) throw new NotFoundError("Version nicht gefunden");
  return {
    planId: version.planId.toString(),
    ...(await toContentDto(version, coachId)),
    replacedAt: version.replacedAt.toISOString(),
  };
}

/** Aktiver Plan des angemeldeten Athleten samt Details der verwendeten Übungen. */
export async function getMyPlan(athleteId: string): Promise<MyPlanResponse> {
  const plan = await TrainingPlanModel.findOne({ athleteId, status: "active" }).lean<StoredPlan>();
  return { plan: plan ? await toPlanDto(plan, null) : null };
}
