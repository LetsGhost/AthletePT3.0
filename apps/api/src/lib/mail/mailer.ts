import nodemailer, { type Transporter } from "nodemailer";

import { env } from "../../config/env";
import { logger } from "../logger/logger";

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const log = logger.child({ label: "mail" });

/** Im Speicher gesammelte Mails (nur MAIL_TRANSPORT=memory, für Tests). */
export const sentMails: Mail[] = [];

let smtp: Transporter | undefined;

async function sendViaResend(mail: Mail) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: env.MAIL_FROM, ...mail, to: [mail.to] }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Resend antwortet mit ${response.status}: ${await response.text()}`);
  }
}

async function sendViaSmtp(mail: Mail) {
  smtp ??= nodemailer.createTransport(env.SMTP_URL);
  await smtp.sendMail({ from: env.MAIL_FROM, ...mail });
}

/**
 * Versendet eine Mail über den konfigurierten Transport. Wirft bei Fehlern; der Aufrufer
 * entscheidet, ob ein fehlgeschlagener Versand die Aktion scheitern lässt.
 */
export async function sendMail(mail: Mail): Promise<void> {
  switch (env.mailTransport) {
    case "resend":
      await sendViaResend(mail);
      break;
    case "smtp":
      await sendViaSmtp(mail);
      break;
    case "console":
      log.info(`Mail an ${mail.to}: ${mail.subject}\n${mail.text}`);
      break;
    case "memory":
      sentMails.push(mail);
      break;
  }
  log.debug("Mail versendet", { to: mail.to, subject: mail.subject, transport: env.mailTransport });
}

/** Wie `sendMail`, schluckt aber Fehler und meldet nur Erfolg/Misserfolg zurück. */
export async function trySendMail(mail: Mail): Promise<boolean> {
  try {
    await sendMail(mail);
    return true;
  } catch (error) {
    log.error("Mailversand fehlgeschlagen", {
      to: mail.to,
      subject: mail.subject,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
