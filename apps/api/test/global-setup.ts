import { MongoMemoryReplSet } from "mongodb-memory-server";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    mongoUri: string;
  }
}

/** Startet einmal pro Testlauf ein In-Memory-Replica-Set (für Transaktionen). */
export default async function setup(project: TestProject) {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  project.provide("mongoUri", replSet.getUri());

  return async () => {
    await replSet.stop();
  };
}
