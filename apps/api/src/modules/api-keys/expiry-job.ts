import { logger } from "../../lib/logger/logger";
import { sendExpiryNotices } from "./api-key.service";

const INTERVAL_MS = 6 * 60 * 60 * 1000;

async function run() {
  try {
    const sent = await sendExpiryNotices();
    if (sent > 0) logger.info(`Ablaufhinweise für API-Keys verschickt: ${sent}`);
  } catch (error) {
    logger.error("Ablaufhinweise für API-Keys fehlgeschlagen", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Prüft beim Start und danach alle 6 Stunden auf bald ablaufende Keys. Reicht für eine einzelne
 * API-Instanz; jeder Key bekommt höchstens einen Hinweis (siehe `sendExpiryNotices`).
 */
export function startApiKeyExpiryJob() {
  void run();
  setInterval(() => void run(), INTERVAL_MS).unref();
}
