import {
  acceptInvitationRequestSchema,
  authResponseSchema,
  changePasswordRequestSchema,
  invitationInfoSchema,
  loginRequestSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  tokenRequestSchema,
  userSchema,
} from "@athletept/shared";
import type { Request, Response } from "express";

import { env } from "../../config/env";
import { UnauthorizedError } from "../../lib/errors";
import { API_PREFIX } from "../../lib/openapi";
import { createModuleRouter } from "../../lib/router";
import { credentialsLimiter, mailLimiter } from "../../middleware/rate-limit";
import * as authService from "./auth.service";
import * as recoveryService from "./recovery.service";

export const REFRESH_COOKIE = "atp_refresh";
const REFRESH_COOKIE_PATH = `${API_PREFIX}/auth`;

function setRefreshCookie(res: Response, token: string, expires: Date) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.isProduction,
    // Strict: Das Cookie wird nie bei Cross-Site-Requests mitgeschickt (CSRF-Schutz).
    sameSite: "strict",
    path: REFRESH_COOKIE_PATH,
    expires,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "strict",
    path: REFRESH_COOKIE_PATH,
  });
}

export function readRefreshCookie(req: Request): string | undefined {
  const value: unknown = req.cookies?.[REFRESH_COOKIE];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function respondWithSession(res: Response, session: authService.IssuedSession) {
  setRefreshCookie(res, session.refreshToken, session.refreshExpiresAt);
  const { accessToken, expiresIn, user } = session;
  return { accessToken, expiresIn, user };
}

const auth = createModuleRouter("/auth", "Auth");

auth.route({
  method: "post",
  path: "/login",
  summary: "Anmelden",
  description: "Liefert ein Access-Token und setzt das Refresh-Cookie.",
  auth: false,
  body: loginRequestSchema,
  response: authResponseSchema,
  errors: [403, 429],
  middleware: [credentialsLimiter],
  handler: async ({ req, res, body }) => {
    const session = await authService.login(body.email, body.password, {
      userAgent: req.get("user-agent"),
    });
    return respondWithSession(res, session);
  },
});

auth.route({
  method: "post",
  path: "/refresh",
  summary: "Sitzung erneuern",
  description:
    "Tauscht das Refresh-Cookie gegen ein neues Access-Token und ein neues Cookie (Rotation). " +
    "Antwortet mit 409 `refresh_conflict`, wenn ein paralleler Refresh gewonnen hat. Dann einfach erneut versuchen.",
  auth: false,
  response: authResponseSchema,
  errors: [409],
  handler: async ({ req, res }) => {
    const token = readRefreshCookie(req);
    if (!token) {
      throw new UnauthorizedError("Nicht angemeldet", "no_session");
    }
    try {
      const session = await authService.refresh(token, { userAgent: req.get("user-agent") });
      return respondWithSession(res, session);
    } catch (error) {
      if (error instanceof UnauthorizedError) clearRefreshCookie(res);
      throw error;
    }
  },
});

auth.route({
  method: "post",
  path: "/logout",
  summary: "Abmelden",
  description: "Widerruft die Sitzung dieses Geräts und löscht das Refresh-Cookie.",
  auth: false,
  status: 204,
  handler: async ({ req, res }) => {
    await authService.logout(readRefreshCookie(req));
    clearRefreshCookie(res);
  },
});

auth.route({
  method: "get",
  path: "/me",
  summary: "Angemeldeten Benutzer abrufen",
  auth: "any",
  apiKeyScope: "any",
  response: userSchema,
  errors: [404],
  handler: ({ auth }) => authService.getCurrentUser(auth.userId),
});

auth.route({
  method: "post",
  path: "/change-password",
  summary: "Passwort ändern",
  description: "Prüft das aktuelle Passwort. Alle anderen Geräte werden abgemeldet.",
  auth: "any",
  body: changePasswordRequestSchema,
  status: 204,
  errors: [403],
  middleware: [credentialsLimiter],
  handler: async ({ req, auth, body }) => {
    await authService.changePassword(
      auth.userId,
      body.currentPassword,
      body.newPassword,
      readRefreshCookie(req),
    );
  },
});

// Tokens stehen im Body statt in der URL, damit sie nicht in Zugriffslogs landen.
auth.route({
  method: "post",
  path: "/invitations/inspect",
  summary: "Einladung prüfen",
  description: "Liefert Name und E-Mail zu einem gültigen Einladungstoken.",
  auth: false,
  body: tokenRequestSchema,
  response: invitationInfoSchema,
  middleware: [credentialsLimiter],
  handler: ({ body }) => recoveryService.getInvitationInfo(body.token),
});

auth.route({
  method: "post",
  path: "/invitations/accept",
  summary: "Einladung annehmen",
  description:
    "Setzt das Passwort, aktiviert das Konto und meldet direkt an (setzt das Refresh-Cookie). " +
    "Athleten müssen `healthDataConsent` zur aktuellen Version der Datenschutzerklärung mitschicken, " +
    "sonst 400 `consent_required` bzw. 409 `privacy_policy_outdated`.",
  auth: false,
  body: acceptInvitationRequestSchema,
  response: authResponseSchema,
  errors: [409],
  middleware: [credentialsLimiter],
  handler: async ({ req, res, body }) => {
    const session = await recoveryService.acceptInvitation(body, {
      userAgent: req.get("user-agent"),
    });
    return respondWithSession(res, session);
  },
});

auth.route({
  method: "post",
  path: "/password-reset/request",
  summary: "Passwort-Reset anfordern",
  description:
    "Schickt einen Reset-Link, falls ein aktives Konto mit der Adresse existiert. " +
    "Antwortet immer mit 204, damit sich nicht herausfinden lässt, welche Adressen registriert sind.",
  auth: false,
  body: passwordResetRequestSchema,
  status: 204,
  middleware: [mailLimiter],
  handler: async ({ body }) => {
    await recoveryService.requestPasswordReset(body.email);
  },
});

auth.route({
  method: "post",
  path: "/password-reset/confirm",
  summary: "Neues Passwort per Reset-Link setzen",
  description: "Meldet alle Geräte ab. Danach mit dem neuen Passwort anmelden.",
  auth: false,
  body: passwordResetConfirmSchema,
  status: 204,
  middleware: [credentialsLimiter],
  handler: async ({ body }) => {
    await recoveryService.confirmPasswordReset(body.token, body.password);
  },
});

export const authRouter = auth;
