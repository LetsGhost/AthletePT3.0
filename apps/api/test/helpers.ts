import {
  PRIVACY_POLICY_VERSION,
  type HealthDataConsent,
  type UserRole,
  type UserStatus,
} from "@athletept/shared";
import type { Types } from "mongoose";
import supertest from "supertest";

import { createApp } from "../src/app";
import { sentMails } from "../src/lib/mail/mailer";
import { hashPassword } from "../src/lib/password";
import { UserModel } from "../src/modules/users/user.model";

export const app = createApp();
export const api = () => supertest(app);

export const DEFAULT_PASSWORD = "correct-horse-battery";

/** Gültige Einwilligung in die Verarbeitung von Gesundheitsdaten (Einladung annehmen als Athlet). */
export const CONSENT: HealthDataConsent = {
  accepted: true,
  privacyPolicyVersion: PRIVACY_POLICY_VERSION,
};

let counter = 0;

export async function createUser(
  overrides: {
    role?: UserRole;
    status?: UserStatus;
    email?: string;
    name?: string;
    password?: string;
    coachId?: Types.ObjectId | null;
    athleteQuota?: number;
  } = {},
) {
  counter += 1;
  const role = overrides.role ?? "athlete";
  return UserModel.create({
    email: overrides.email ?? `${role}${counter}@example.com`,
    name: overrides.name ?? `${role} ${counter}`,
    role,
    status: overrides.status ?? "active",
    coachId: overrides.coachId ?? null,
    athleteQuota: overrides.athleteQuota ?? (role === "coach" ? 5 : null),
    passwordHash: await hashPassword(overrides.password ?? DEFAULT_PASSWORD),
  });
}

/** Letzte Mail an `to` und das Token aus dem enthaltenen Link (`#token=…`). */
export function lastMailTo(to: string) {
  const mail = sentMails.filter((m) => m.to === to).at(-1);
  if (!mail) throw new Error(`Keine Mail an ${to}`);
  const token = /#token=([\w-]+)/.exec(mail.text)?.[1];
  return { mail, token: token! };
}

/** Extrahiert das Refresh-Cookie (`name=value`) aus einer Login-/Refresh-Antwort. */
export function refreshCookieFrom(res: supertest.Response) {
  const header = res.headers["set-cookie"] as unknown as string[] | undefined;
  const cookie = header?.find((c) => c.startsWith("atp_refresh="));
  return cookie?.split(";")[0];
}

export async function login(email: string, password = DEFAULT_PASSWORD) {
  const res = await api().post("/api/v1/auth/login").send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Login fehlgeschlagen: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return {
    accessToken: res.body.accessToken as string,
    cookie: refreshCookieFrom(res)!,
    bearer: `Bearer ${res.body.accessToken as string}`,
  };
}

/** Legt einen User an und meldet ihn an. */
export async function createAndLogin(overrides: Parameters<typeof createUser>[0] = {}) {
  const user = await createUser(overrides);
  const session = await login(user.email, overrides.password);
  return { user, ...session };
}
