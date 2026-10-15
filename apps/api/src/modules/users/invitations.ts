import type { ClientSession } from "mongoose";

import { env } from "../../config/env";
import { trySendMail } from "../../lib/mail/mailer";
import { invitationMail } from "../../lib/mail/templates";
import type { UserDocument } from "./user.model";
import { TOKEN_LIFETIME, issueUserToken } from "./user-token.service";

/**
 * Link zur Einladungsseite. Das Token steht im Fragment (#), damit es nie in
 * Server- oder Proxy-Logs landet.
 */
export function invitationUrl(token: string) {
  return `${env.APP_URL}/invite#token=${token}`;
}

/** Legt ein Einladungstoken an. Innerhalb der Transaktion aufrufen, die den User erzeugt. */
export function createInvitationToken(user: UserDocument, session?: ClientSession) {
  return issueUserToken(user._id, "invitation", session);
}

/** Verschickt die Einladung. Nach dem Commit aufrufen. Liefert, ob der Versand geklappt hat. */
export function sendInvitationMail(user: UserDocument, token: string, inviterName: string) {
  return trySendMail(
    invitationMail({
      to: user.email,
      name: user.name,
      role: user.role,
      inviterName,
      url: invitationUrl(token),
      validDays: TOKEN_LIFETIME.invitation / (24 * 60 * 60 * 1000),
    }),
  );
}

/** Neue Einladung für einen noch nicht aktivierten User (alter Link wird ungültig). */
export async function resendInvitation(user: UserDocument, inviterName: string) {
  const token = await createInvitationToken(user);
  return sendInvitationMail(user, token, inviterName);
}
