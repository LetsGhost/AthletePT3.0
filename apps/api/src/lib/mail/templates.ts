import { APP_TIME_ZONE, type UserRole } from "@athletept/shared";

import type { Mail } from "./mailer";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buttonHtml(button: { label: string; url: string }) {
  return `<p style="margin:24px 0"><a href="${escapeHtml(button.url)}" style="display:inline-block;background:#035671;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:12px;font-weight:bold">${button.label}</a></p>
<p style="margin:0;font-size:13px;color:#595959;line-height:1.5">Funktioniert der Button nicht? Kopiere diesen Link in deinen Browser:<br><span style="word-break:break-all">${escapeHtml(button.url)}</span></p>`;
}

/** Schlichtes, mailclient-taugliches Layout (Tabellen, Inline-Styles). */
function layout(heading: string, paragraphs: string[], button?: { label: string; url: string }) {
  const body = paragraphs
    .map((p) => `<p style="margin:0 0 16px;line-height:1.5">${p}</p>`)
    .join("");
  return `<!doctype html>
<html lang="de"><body style="margin:0;background:#f4f2f2;font-family:Arial,Helvetica,sans-serif;color:#101010">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;padding:32px">
<tr><td>
<p style="margin:0 0 24px;font-weight:bold;font-size:18px">AthletePT</p>
<h1 style="margin:0 0 16px;font-size:22px;font-weight:600">${heading}</h1>
${body}
${button ? buttonHtml(button) : ""}
</td></tr></table>
</td></tr></table>
</body></html>`;
}

const roleText: Record<UserRole, string> = {
  athlete: "dein Coaching",
  coach: "AthletePT als Coach",
  sysadmin: "die Administration von AthletePT",
};

export function invitationMail(params: {
  to: string;
  name: string;
  role: UserRole;
  inviterName: string;
  url: string;
  validDays: number;
}): Mail {
  const { to, name, role, inviterName, url, validDays } = params;
  const subject = "Deine Einladung zu AthletePT";
  const intro = `${inviterName} hat dich zu AthletePT eingeladen. Lege jetzt dein Passwort fest, um ${roleText[role]} zu starten.`;
  const validity = `Der Link ist ${validDays} Tage gültig.`;
  return {
    to,
    subject,
    html: layout(`Hallo ${escapeHtml(name)}!`, [escapeHtml(intro), escapeHtml(validity)], {
      label: "Passwort festlegen",
      url,
    }),
    text: `Hallo ${name}!\n\n${intro}\n\n${url}\n\n${validity}`,
  };
}

export function passwordResetMail(params: {
  to: string;
  name: string;
  url: string;
  validMinutes: number;
}): Mail {
  const { to, name, url, validMinutes } = params;
  const intro = "Du hast ein neues Passwort für AthletePT angefordert.";
  const validity = `Der Link ist ${validMinutes} Minuten gültig. Wenn du das nicht warst, kannst du diese Mail ignorieren. Dein Passwort bleibt dann unverändert.`;
  return {
    to,
    subject: "Passwort zurücksetzen",
    html: layout(`Hallo ${escapeHtml(name)}!`, [escapeHtml(intro), escapeHtml(validity)], {
      label: "Neues Passwort festlegen",
      url,
    }),
    text: `Hallo ${name}!\n\n${intro}\n\n${url}\n\n${validity}`,
  };
}

export function apiKeyPickupMail(params: {
  to: string;
  name: string;
  appName: string;
  url: string;
  validDays: number;
}): Mail {
  const { to, name, appName, url, validDays } = params;
  const intro = `Für dich wurde ein API-Zugang für die App „${appName}“ eingerichtet. Melde dich über den Link an, um den Schlüssel abzuholen. Er wird dir nur ein einziges Mal angezeigt.`;
  const validity = `Der Link ist ${validDays} Tage gültig. Wenn du keinen Zugang erwartet hast, ignoriere diese Mail. Ohne Abholung bleibt der Zugang inaktiv.`;
  return {
    to,
    subject: "Dein API-Zugang für AthletePT",
    html: layout(`Hallo ${escapeHtml(name)}!`, [escapeHtml(intro), escapeHtml(validity)], {
      label: "Schlüssel abholen",
      url,
    }),
    text: `Hallo ${name}!\n\n${intro}\n\n${url}\n\n${validity}`,
  };
}

export function apiKeyExpiryMail(params: {
  to: string;
  name: string;
  appName: string;
  expiresAt: Date;
}): Mail {
  const { to, name, appName, expiresAt } = params;
  const date = expiresAt.toLocaleDateString("de-DE", { timeZone: APP_TIME_ZONE });
  const intro = `Der API-Zugang für die App „${appName}“ läuft am ${date} ab. Danach kann die App nicht mehr auf deine Daten zugreifen.`;
  const action =
    "Möchtest du die App weiter nutzen, bitte den Sysadmin um eine Erneuerung. Du bekommst dann einen neuen Link zum Abholen.";
  return {
    to,
    subject: "Dein API-Zugang läuft bald ab",
    html: layout(`Hallo ${escapeHtml(name)}!`, [escapeHtml(intro), escapeHtml(action)]),
    text: `Hallo ${name}!\n\n${intro}\n\n${action}`,
  };
}
