import mongoose from "mongoose";
import { describe, expect, it } from "vitest";

import { api, createAndLogin, createUser } from "../../../test/helpers";

/** Felder, über die ein Dokument einem Athleten gehört. Neue Besitzerfelder hier ergänzen. */
const OWNER_FIELDS = ["athleteId", "userId", "recipientId", "ownerAthleteId"];

/** Jedes Model mit seinen Besitzerfeldern, ermittelt aus den Schemas. */
function ownedModels() {
  return mongoose
    .modelNames()
    .map((name) => mongoose.model(name))
    .map((model) => ({
      model,
      fields: OWNER_FIELDS.filter((field) => model.schema.path(field)),
    }))
    .filter(({ fields }) => fields.length > 0);
}

describe("Athlet endgültig löschen (DSGVO)", () => {
  // Legt in jeder Collection mit Besitzerfeld ein Dokument an. Vergisst ein neues Modul
  // `deleteAllAthleteData`, schlägt dieser Test fehl.
  it("löscht die Daten des Athleten aus jeder Collection", async () => {
    const coach = await createAndLogin({ role: "coach" });
    const athlete = await createUser({ role: "athlete", coachId: coach.user._id });
    const models = ownedModels();
    expect(models.length).toBeGreaterThan(5);
    for (const { model, fields } of models) {
      // Roh einfügen: Es geht nur um den Verweis, nicht um gültige Inhalte.
      await model.collection.insertOne(
        Object.fromEntries(fields.map((field) => [field, athlete._id])),
      );
    }

    await api()
      .delete(`/api/v1/athletes/${athlete.id}`)
      .set("Authorization", coach.bearer)
      .expect(204);

    for (const { model, fields } of models) {
      for (const field of fields) {
        const left = await model.collection.countDocuments({ [field]: athlete._id });
        expect(left, `${model.modelName}.${field}`).toBe(0);
      }
    }
    expect(await mongoose.model("User").exists({ _id: athlete._id })).toBeNull();
  });
});
