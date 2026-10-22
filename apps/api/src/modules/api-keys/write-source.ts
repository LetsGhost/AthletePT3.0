import type { WriteSource } from "@athletept/shared";
import { Schema, type Types } from "mongoose";

import type { AuthContext } from "../../types/express";

export interface StoredWriteSource {
  apiKeyId: Types.ObjectId;
  appName: string;
}

/**
 * Feld für Modelle, deren Änderungen auch über API-Keys kommen: Welche App zuletzt geschrieben hat
 * (`null`: Web-App). Hilft bei der Frage „Wer hat das geändert?“. Der App-Name wird mitgespeichert,
 * damit er auch nach Umbenennen oder Löschen des Keys lesbar bleibt.
 */
export const writeSourceField = {
  lastWriteVia: {
    type: new Schema(
      {
        apiKeyId: { type: Schema.Types.ObjectId, ref: "ApiKey", required: true },
        appName: { type: String, required: true },
      },
      { _id: false },
    ),
    default: null,
  },
};

/** Wert für `lastWriteVia` bei einem Schreibzugriff, `null` aus der Web-App. */
export type WriteSourceInput = { apiKeyId: string; appName: string } | null;

export function writeSource(auth: Pick<AuthContext, "apiKey">): WriteSourceInput {
  return auth.apiKey ? { apiKeyId: auth.apiKey.id, appName: auth.apiKey.name } : null;
}

export function toWriteSourceDto(source: StoredWriteSource | null | undefined): WriteSource {
  return source ? { appName: source.appName } : null;
}
