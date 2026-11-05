import { createApp } from "./app";
import { env } from "./config/env";
import { connectDatabase, disconnectDatabase } from "./lib/db";
import { logger } from "./lib/logger/logger";
import { startApiKeyExpiryJob } from "./modules/api-keys/expiry-job";
import { startChallengeJob } from "./modules/challenges/challenge-job";
import { seedGlobalExercises } from "./modules/exercises/exercise-seed";
import { ExerciseModel } from "./modules/exercises/exercise.model";
import { backfillWorkoutStats } from "./modules/stats/exercise-stats.service";

async function main() {
  await connectDatabase();
  // Idempotent: ersetzt den alten Namensindex (nur Coach) durch den mit privaten Übungen.
  await ExerciseModel.syncIndexes();
  // Idempotent: ergänzt nur fehlende Startübungen im globalen Katalog.
  await seedGlobalExercises();
  // Idempotent: berechnet fehlende oder veraltete Trainingskennzahlen (Übungsanalyse).
  await backfillWorkoutStats();

  const server = createApp().listen(env.PORT, () => {
    logger.info(`AthletePT API läuft auf Port ${env.PORT} (${env.NODE_ENV})`);
    if (env.isProduction && env.TRUST_PROXY === 0) {
      // Hinter nginx sähe die API sonst nur die Proxy-IP: Alle anonymen Clients teilen sich
      // dann ein Rate-Limit.
      logger.warn("TRUST_PROXY=0 in Produktion: Rate-Limits zählen pro Proxy- statt Client-IP");
    }
    startApiKeyExpiryJob();
    startChallengeJob();
    if (env.apiDocsEnabled) {
      logger.info(`API-Doku: http://localhost:${env.PORT}/api/v1/docs`);
    }
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} empfangen, fahre herunter`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    // Notbremse, falls offene Verbindungen das Schließen blockieren
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error: unknown) => {
  logger.error("Start fehlgeschlagen", {
    error: error instanceof Error ? (error.stack ?? error.message) : String(error),
  });
  process.exit(1);
});
