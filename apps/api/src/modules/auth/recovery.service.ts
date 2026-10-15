import {
  PRIVACY_POLICY_VERSION,
  type HealthDataConsent,
  type InvitationInfo,
} from "@athletept/shared";

import { env } from "../../config/env";
import { withTransaction } from "../../lib/db";
import { AppError, BadRequestError, ConflictError } from "../../lib/errors";
import { logger } from "../../lib/logger/logger";
import { trySendMail } from "../../lib/mail/mailer";
import { passwordResetMail } from "../../lib/mail/templates";
import { hashPassword } from "../../lib/password";
import { UserModel } from "../users/user.model";
import { UserTokenModel } from "../users/user-token.model";
import {
  TOKEN_LIFETIME,
  consumeUserToken,
  findUserByToken,
  issueUserToken,
} from "../users/user-token.service";
import { issueSession, revokeAllSessions, type ClientMeta } from "./auth.service";

/** Innerhalb dieser Zeit nach einem Reset-Link wird kein neuer ausgestellt. */
const RESET_REQUEST_COOLDOWN_MS = 5 * 60 * 1000;

/** Daten für die Einladungsseite („Hallo Max, lege dein Passwort fest“). */
export async function getInvitationInfo(token: string): Promise<InvitationInfo> {
  const user = await findUserByToken(token, "invitation");
  if (user.status !== "invited") {
    throw new BadRequestError("Diese Einladung wurde bereits angenommen.", "invitation_used");
  }
  return {
    name: user.name,
    email: user.email,
    role: user.role,
    healthDataConsentRequired: user.role === "athlete",
  };
}

/**
 * Athleten müssen in die Verarbeitung ihrer Gesundheitsdaten einwilligen, und zwar zur aktuell
 * gültigen Datenschutzerklärung. Ohne Einwilligung wird die Einladung nicht angenommen.
 */
function checkHealthDataConsent(consent: HealthDataConsent | undefined) {
  if (!consent) {
    const message = "Bitte willige in die Verarbeitung deiner Gesundheitsdaten ein";
    throw new AppError(400, "consent_required", message, [{ path: "healthDataConsent", message }]);
  }
  if (consent.privacyPolicyVersion !== PRIVACY_POLICY_VERSION) {
    throw new ConflictError(
      "Die Datenschutzerklärung wurde inzwischen aktualisiert. Bitte lade die Seite neu und lies sie erneut.",
      "privacy_policy_outdated",
    );
  }
  return { grantedAt: new Date(), privacyPolicyVersion: consent.privacyPolicyVersion };
}

/** Einladung annehmen: Passwort setzen, Konto aktivieren und direkt anmelden. */
export async function acceptInvitation(
  input: { token: string; password: string; healthDataConsent?: HealthDataConsent | undefined },
  meta: ClientMeta,
) {
  // Erst den Link prüfen: bcrypt ist teuer und soll nicht für beliebige Tokens laufen.
  await findUserByToken(input.token, "invitation");
  const passwordHash = await hashPassword(input.password);

  const user = await withTransaction(async (session) => {
    // Schlägt danach etwas fehl, bricht die Transaktion ab und der Link bleibt gültig.
    const invited = await consumeUserToken(input.token, "invitation", session);
    if (invited.status !== "invited") {
      throw new BadRequestError("Diese Einladung wurde bereits angenommen.", "invitation_used");
    }
    if (invited.role === "athlete") {
      invited.healthDataConsent = checkHealthDataConsent(input.healthDataConsent);
    }
    invited.passwordHash = passwordHash;
    invited.status = "active";
    invited.lastLoginAt = new Date();
    await invited.save({ session });
    return invited;
  });

  logger.info("Einladung angenommen", { userId: user._id.toString(), role: user.role });
  return issueSession(user, meta);
}

/**
 * Reset-Mail anfordern. Antwortet immer gleich, egal ob es die Adresse gibt
 * (keine User-Enumeration). Die Mail geht im Hintergrund raus, damit auch die
 * Antwortzeit nichts verrät.
 */
export async function requestPasswordReset(email: string) {
  const user = await UserModel.findOne({ email, status: "active" });
  if (!user) return;

  // Ein frischer Link bleibt gültig: Sonst könnte jeder, der die Adresse kennt, den gerade
  // verschickten Link des Users per neuem Request entwerten und ihm beliebig Mails schicken.
  const recentlyIssued = await UserTokenModel.exists({
    userId: user._id,
    type: "password_reset",
    expiresAt: { $gt: new Date() },
    createdAt: { $gt: new Date(Date.now() - RESET_REQUEST_COOLDOWN_MS) },
  });
  if (recentlyIssued) return;

  const token = await issueUserToken(user._id, "password_reset");
  void trySendMail(
    passwordResetMail({
      to: user.email,
      name: user.name,
      url: `${env.APP_URL}/reset-password#token=${token}`,
      validMinutes: TOKEN_LIFETIME.password_reset / (60 * 1000),
    }),
  );
}

/** Neues Passwort über den Reset-Link setzen. Meldet alle Geräte ab. */
export async function confirmPasswordReset(token: string, password: string) {
  await findUserByToken(token, "password_reset");
  const passwordHash = await hashPassword(password);
  const user = await withTransaction(async (session) => {
    const target = await consumeUserToken(token, "password_reset", session);
    if (target.status !== "active") {
      throw new BadRequestError(
        "Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.",
        "invalid_token",
      );
    }
    target.passwordHash = passwordHash;
    await target.save({ session });
    return target;
  });
  await revokeAllSessions(user._id);
  logger.info("Passwort per Reset-Link geändert", { userId: user._id.toString() });
}
