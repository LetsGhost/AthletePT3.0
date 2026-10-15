import mongoose, { type ClientSession } from "mongoose";

import { env } from "../config/env";
import { logger } from "./logger/logger";

mongoose.set("strictQuery", true);

export async function connectDatabase(uri = env.MONGO_URI) {
  await mongoose.connect(uri, {
    user: env.MONGO_USER,
    pass: env.MONGO_PASSWORD,
    authSource: env.MONGO_AUTH_SOURCE,
  });
  logger.info("MongoDB verbunden");
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}

/**
 * Führt `fn` in einer Transaktion aus. Setzt ein Replica Set voraus
 * (lokal über docker-compose, in Tests über mongodb-memory-server).
 */
export async function withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(() => fn(session));
  } finally {
    await session.endSession();
  }
}
