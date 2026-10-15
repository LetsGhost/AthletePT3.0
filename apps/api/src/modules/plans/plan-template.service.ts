import type {
  PlanTemplate,
  PlanTemplateListResponse,
  createPlanRequestSchema,
  updatePlanRequestSchema,
} from "@athletept/shared";
import type { z } from "zod";

import { ConflictError, NotFoundError } from "../../lib/errors";
import { buildContent, toContentDto } from "./plan-content";
import { PlanTemplateModel, type StoredPlanTemplate } from "./plan-template.model";

type CreateInput = z.output<typeof createPlanRequestSchema>;
type UpdateInput = z.output<typeof updatePlanRequestSchema>;

async function toTemplateDto(template: StoredPlanTemplate, coachId: string): Promise<PlanTemplate> {
  return {
    id: template._id.toString(),
    ...(await toContentDto(template, coachId)),
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

/** Fremde und nicht existierende Vorlagen liefern beide 404. */
async function findTemplate(coachId: string, id: string) {
  const template = await PlanTemplateModel.findOne({
    _id: id,
    ownerCoachId: coachId,
  }).lean<StoredPlanTemplate>();
  if (!template) throw new NotFoundError("Vorlage nicht gefunden");
  return template;
}

export async function listTemplates(coachId: string): Promise<PlanTemplateListResponse> {
  const templates = await PlanTemplateModel.find({ ownerCoachId: coachId })
    .sort({ name: 1 })
    .collation({ locale: "de" })
    .lean<StoredPlanTemplate[]>();
  return {
    items: templates.map((template) => ({
      id: template._id.toString(),
      name: template.name,
      type: template.type,
      dayCount: template.days.length,
      updatedAt: template.updatedAt.toISOString(),
    })),
  };
}

export async function getTemplate(coachId: string, id: string) {
  return toTemplateDto(await findTemplate(coachId, id), coachId);
}

export async function createTemplate(coachId: string, input: CreateInput) {
  const content = await buildContent(coachId, input, null);
  const created = await PlanTemplateModel.create({
    ownerCoachId: coachId,
    revision: 0,
    ...content,
  });
  return getTemplate(coachId, created._id.toString());
}

export async function updateTemplate(coachId: string, id: string, input: UpdateInput) {
  const template = await findTemplate(coachId, id);
  const content = await buildContent(coachId, input, template);
  const result = await PlanTemplateModel.updateOne(
    { _id: template._id, revision: input.revision },
    { $set: content, $inc: { revision: 1 } },
  );
  if (result.matchedCount === 0) {
    throw new ConflictError(
      "Die Vorlage wurde inzwischen geändert. Lade sie neu, um die aktuelle Fassung zu sehen.",
      "plan_conflict",
    );
  }
  return getTemplate(coachId, id);
}

/** Pläne, die aus der Vorlage entstanden sind, bleiben unberührt (sie sind Kopien). */
export async function deleteTemplate(coachId: string, id: string) {
  const template = await findTemplate(coachId, id);
  await PlanTemplateModel.deleteOne({ _id: template._id });
}
