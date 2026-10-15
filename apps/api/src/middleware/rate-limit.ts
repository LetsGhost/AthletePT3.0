import type { Request } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";

import { env } from "../config/env";
import { logger } from "../lib/logger/logger";
import { verifyAccessToken } from "../modules/auth/access-token";
import { bearerToken } from "./authenticate";
import { sendProblem } from "./error-handler";

interface LimiterOptions {
  windowMinutes: number;
  limit: number;
  /** Nur fehlgeschlagene Requests zählen (für Login & Co.). */
  onlyFailures?: boolean;
}

let enforcedInTests = false;

/** In Tests sind die Limiter aus; Tests, die sie selbst prüfen, schalten sie hiermit ein. */
export function enforceRateLimitsInTests(enabled: boolean) {
  enforcedInTests = enabled;
}

/**
 * Angemeldete Nutzer werden pro Konto gezählt, anonyme pro IP, jeweils in eigenen Buckets. So
 * blockiert anonymer Traffic keine angemeldeten Nutzer hinter derselben IP (z. B. Studio-WLAN).
 *
 * Der `apiLimiter` läuft vor `authenticate`; deshalb wird das Token hier selbst geprüft, aber nur
 * die Signatur (ohne Datenbank). Ein gesperrter User mit noch signiertem Token zählt also weiter
 * auf sein Konto, wird von `authenticate` aber abgewiesen.
 */
function limiterKey(req: Request) {
  if (req.auth) return `user:${req.auth.userId}`;
  const token = bearerToken(req);
  if (token) {
    try {
      return `user:${verifyAccessToken(token).userId}`;
    } catch {
      // Ungültig oder abgelaufen: zählt wie ein anonymer Request.
    }
  }
  return `ip:${ipKeyGenerator(req.ip ?? "unknown")}`;
}

/**
 * In-Memory-Store: reicht für eine einzelne API-Instanz. Bei mehreren Instanzen
 * muss ein gemeinsamer Store (z. B. Redis) eingesetzt werden.
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
    skip: () => env.isTest && !enforcedInTests,
    keyGenerator: limiterKey,
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
