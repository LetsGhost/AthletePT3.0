/**
 * Legt einen Sysadmin an. Der erste Admin lässt sich nur so erzeugen, nicht über die API.
 *
 *   npm run create-sysadmin -w @athletept/api -- --email admin@example.com --name "Max Muster"
 *
 * Das Passwort kommt aus der Umgebungsvariable SYSADMIN_PASSWORD. Fehlt sie, wird ein
 * zufälliges Passwort erzeugt und einmalig ausgegeben.
 */
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";

import { emailSchema, passwordSchema, personNameSchema } from "@athletept/shared";
import { z } from "zod";

import { connectDatabase, disconnectDatabase } from "../lib/db";
import { hashPassword } from "../lib/password";
import { UserModel } from "../modules/users/user.model";

const argsSchema = z.object({
  email: emailSchema,
  name: personNameSchema,
  password: passwordSchema.optional(),
});

async function main() {
  const { values } = parseArgs({
    options: { email: { type: "string" }, name: { type: "string" } },
  });

  const parsed = argsSchema.safeParse({
    email: values.email,
    name: values.name,
    password: process.env.SYSADMIN_PASSWORD || undefined,
  });
  if (!parsed.success) {
    console.error("Ungültige Eingabe:");
    for (const issue of parsed.error.issues) {
      console.error(`  --${issue.path.join(".")}: ${issue.message}`);
    }
    console.error('\nAufruf: npm run create-sysadmin -- --email <E-Mail> --name "<Name>"');
    process.exitCode = 1;
    return;
  }

  const { email, name } = parsed.data;
  const generated = !parsed.data.password;
  const password = parsed.data.password ?? randomBytes(15).toString("base64url");

  await connectDatabase();
  try {
    if (await UserModel.exists({ email })) {
      console.error(`Es gibt bereits einen Benutzer mit der E-Mail ${email}.`);
      process.exitCode = 1;
      return;
    }

    await UserModel.create({
      email,
      name,
      role: "sysadmin",
      status: "active",
      passwordHash: await hashPassword(password),
    });

    console.log(`Sysadmin ${email} angelegt.`);
    if (generated) {
      console.log(`Einmaliges Passwort: ${password}`);
      console.log("Bitte nach dem ersten Login unter Einstellungen ändern.");
    }
  } finally {
    await disconnectDatabase();
  }
}

void main();
