import { ipKeyGenerator, rateLimit } from "express-rate-limit";

import { env } from "../config/env";
import { logger } from "../lib/logger/logger";
import { sendProblem } from "./error-handler";

interface LimiterOptions {
  windowMinutes: number;
  limit: number;
  /** Nur fehlgeschlagene Requests zählen (für Login & Co.). */
  onlyFailures?: boolean;
}

/**
 * In-Memory-Store: reicht für eine einzelne API-Instanz. Bei mehreren Instanzen
 * muss ein gemeinsamer Store (z. B. Redis) eingesetzt werden.
 *
 * Angemeldete Nutzer werden pro Konto gezählt, anonyme pro IP.
 */
function createLimiter(
  name: string,
  { windowMinutes, limit, onlyFailures = false }: LimiterOptions,
) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    skipSuccessfulRequests: onlyFailures,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: () => env.isTest,
    keyGenerator: (req) =>
      req.auth ? `user:${req.auth.userId}` : ipKeyGenerator(req.ip ?? "unknown"),
    handler: (req, res) => {
      logger.warn("Rate-Limit überschritten", { limiter: name, ip: req.ip, path: req.path });
      sendProblem(res, 429, "rate_limited", "Zu viele Anfragen. Bitte versuche es später erneut.");
    },
  });
}

export const apiLimiter = createLimiter("api", { windowMinutes: 15, limit: 1000 });
/** Login, Passwort-Reset und ähnliche Brute-Force-Ziele. Zählt nur fehlgeschlagene Versuche. */
export const credentialsLimiter = createLimiter("credentials", {
  windowMinutes: 15,
  limit: 10,
  onlyFailures: true,
});
/** Endpunkte, die Mails auslösen. Zählt jeden Aufruf (Schutz vor Mail-Spam). */
export const mailLimiter = createLimiter("mail", { windowMinutes: 15, limit: 10 });
