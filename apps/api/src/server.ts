import { createApp } from "./app";
import { env } from "./config/env";
import { connectDatabase, disconnectDatabase } from "./lib/db";
import { logger } from "./lib/logger/logger";
import { seedGlobalExercises } from "./modules/exercises/exercise-seed";

async function main() {
  await connectDatabase();
  // Idempotent: ergänzt nur fehlende Startübungen im globalen Katalog.
  await seedGlobalExercises();

  const server = createApp().listen(env.PORT, () => {
    logger.info(`AthletePT API läuft auf Port ${env.PORT} (${env.NODE_ENV})`);
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
