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
import type { AuthContext } from "../../types/express";
import { getAccessibleAthlete } from "../athletes/athlete-access";
import { assertComplete, buildContent, toContentDto } from "./plan-content";
import {
  TrainingPlanModel,
  TrainingPlanVersionModel,
  type StoredPlan,
  type StoredPlanVersion,
} from "./plan.model";

type CreateInput = z.output<typeof createPlanRequestSchema>;
type UpdateInput = z.output<typeof updatePlanRequestSchema>;

const creator = (plan: StoredPlan) => (plan.createdByCoachId ? "coach" : "athlete");

async function toPlanDto(plan: StoredPlan, coachId: string | null): Promise<Plan> {
  return {
    id: plan._id.toString(),
    athleteId: plan.athleteId.toString(),
    status: plan.status,
    createdBy: creator(plan),
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
    createdBy: creator(plan),
    dayCount: plan.days.length,
    activatedAt: plan.activatedAt?.toISOString() ?? null,
    archivedAt: plan.archivedAt?.toISOString() ?? null,
    updatedAt: plan.updatedAt.toISOString(),
  };
}

/**
 * Prüft den Zugriff auf die Pläne eines Athleten: sein Coach oder der Athlet selbst mit der
 * Berechtigung `ownPlan`. Beide haben dieselben Rechte.
 */
async function planAccess(auth: AuthContext, athleteId: string, session?: ClientSession) {
  const athlete = await getAccessibleAthlete(auth, athleteId, "ownPlan", session);
  return {
    /** Wessen Übungskatalog gilt. Athleten planen mit dem Katalog ihres Coaches. */
    catalogCoachId: auth.role === "coach" ? auth.userId : String(athlete.coachId),
    /** Für `createdByCoachId` und `replacedByCoachId`: `null`, wenn der Athlet selbst ändert. */
    actingCoachId: auth.role === "coach" ? auth.userId : null,
  };
}

/** Lädt einen Plan, sofern der Anfragende Zugriff auf den Athleten hat. Sonst 404. */
async function findPlan(
  auth: AuthContext,
  athleteId: string,
  planId: string,
  session?: ClientSession,
) {
  const access = await planAccess(auth, athleteId, session);
  const plan = await TrainingPlanModel.findOne({ _id: planId, athleteId })
    .session(session ?? null)
    .lean<StoredPlan>();
  if (!plan) throw new NotFoundError("Plan nicht gefunden");
  return { plan, ...access };
}

async function reload(planId: StoredPlan["_id"], session?: ClientSession) {
  const plan = await TrainingPlanModel.findById(planId)
    .session(session ?? null)
    .lean<StoredPlan>();
  if (!plan) throw new NotFoundError("Plan nicht gefunden");
  return plan;
}

const statusOrder: Record<PlanStatus, number> = { active: 0, draft: 1, archived: 2 };

export async function listPlans(auth: AuthContext, athleteId: string): Promise<PlanListResponse> {
  await planAccess(auth, athleteId);
  const plans = await TrainingPlanModel.find({ athleteId }).lean<StoredPlan[]>();
  plans.sort(
    (a, b) =>
      statusOrder[a.status] - statusOrder[b.status] ||
      b.updatedAt.getTime() - a.updatedAt.getTime(),
  );
  return { items: plans.map(toSummary) };
}

export async function getPlan(auth: AuthContext, athleteId: string, planId: string) {
  const { plan, catalogCoachId } = await findPlan(auth, athleteId, planId);
  return toPlanDto(plan, catalogCoachId);
}

/** Neue Pläne sind Entwürfe. Der Athlet sieht sie erst nach dem Aktivieren. */
export async function createPlan(auth: AuthContext, athleteId: string, input: CreateInput) {
  const { catalogCoachId, actingCoachId } = await planAccess(auth, athleteId);
  const content = await buildContent(catalogCoachId, input, null);
  const created = await TrainingPlanModel.create({
    athleteId,
    createdByCoachId: actingCoachId,
    status: "draft",
    revision: 0,
    ...content,
  });
  return toPlanDto(await reload(created._id), catalogCoachId);
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
  auth: AuthContext,
  athleteId: string,
  planId: string,
  input: UpdateInput,
) {
  const { plan: updated, catalogCoachId } = await withTransaction(async (session) => {
    const { plan, catalogCoachId, actingCoachId } = await findPlan(
      auth,
      athleteId,
      planId,
      session,
    );
    if (plan.status === "archived") {
      throw new ConflictError(
        "Archivierte Pläne lassen sich nicht bearbeiten. Dupliziere ihn, um darauf aufzubauen.",
        "plan_archived",
      );
    }
    if (plan.revision !== input.revision) throw planConflict();

    const content = await buildContent(catalogCoachId, input, plan, session);
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
            replacedByCoachId: actingCoachId,
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
    return { plan: await reload(plan._id, session), catalogCoachId };
  });
  return toPlanDto(updated, catalogCoachId);
}

/** Gibt den Plan für den Athleten frei. Der bisher aktive Plan wird archiviert. */
export async function activatePlan(auth: AuthContext, athleteId: string, planId: string) {
  const { plan: activated, catalogCoachId } = await withTransaction(async (session) => {
    const { plan, catalogCoachId } = await findPlan(auth, athleteId, planId, session);
    if (plan.status === "active") return { plan, catalogCoachId };
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
    return { plan: await reload(plan._id, session), catalogCoachId };
  });
  return toPlanDto(activated, catalogCoachId);
}

/** Archivierte Pläne sieht der Athlet nicht mehr. Sie bleiben für die Historie erhalten. */
export async function archivePlan(auth: AuthContext, athleteId: string, planId: string) {
  const { plan, catalogCoachId } = await findPlan(auth, athleteId, planId);
  if (plan.status !== "archived") {
    await TrainingPlanModel.updateOne(
      { _id: plan._id },
      { $set: { status: "archived", archivedAt: new Date() }, $inc: { revision: 1 } },
    );
  }
  return toPlanDto(await reload(plan._id), catalogCoachId);
}

/** Nur Entwürfe lassen sich löschen; alles, was der Athlet gesehen hat, wird archiviert. */
export async function deletePlan(auth: AuthContext, athleteId: string, planId: string) {
  const { plan } = await findPlan(auth, athleteId, planId);
  if (plan.status !== "draft") {
    throw new ConflictError(
      "Nur Entwürfe lassen sich löschen. Archiviere den Plan stattdessen.",
      "plan_not_draft",
    );
  }
  await TrainingPlanModel.deleteOne({ _id: plan._id });
}

export async function listVersions(
  auth: AuthContext,
  athleteId: string,
  planId: string,
): Promise<PlanVersionListResponse> {
  const { plan } = await findPlan(auth, athleteId, planId);
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
  auth: AuthContext,
  athleteId: string,
  planId: string,
  revision: number,
): Promise<PlanVersion> {
  const { plan, catalogCoachId } = await findPlan(auth, athleteId, planId);
  const version = await TrainingPlanVersionModel.findOne({
    planId: plan._id,
    revision,
  }).lean<StoredPlanVersion>();
  if (!version) throw new NotFoundError("Version nicht gefunden");
  return {
    planId: version.planId.toString(),
    ...(await toContentDto(version, catalogCoachId)),
    replacedAt: version.replacedAt.toISOString(),
  };
}

/** Aktiver Plan des angemeldeten Athleten samt Details der verwendeten Übungen. */
export async function getMyPlan(athleteId: string): Promise<MyPlanResponse> {
  const plan = await TrainingPlanModel.findOne({ athleteId, status: "active" }).lean<StoredPlan>();
  return { plan: plan ? await toPlanDto(plan, null) : null };
}
