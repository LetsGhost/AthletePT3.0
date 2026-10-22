import { existsSync } from "node:fs";

import { z } from "zod";

const booleanString = z
  .enum(["true", "false", "1", "0"])
  .transform((value) => value === "true" || value === "1");

const envSchema = z
  .object({
    // Ohne Angabe gilt production: Ein vergessener Wert darf nie Sicherheitsfunktionen abschalten.
    NODE_ENV: z.enum(["development", "test", "production"]).default("production"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),

    MONGO_URI: z.string().min(1, "MONGO_URI fehlt"),
    MONGO_USER: z.string().min(1).optional(),
    MONGO_PASSWORD: z.string().min(1).optional(),
    MONGO_AUTH_SOURCE: z.string().min(1).optional(),

    JWT_SECRET: z.string().min(32, "JWT_SECRET muss mindestens 32 Zeichen lang sein"),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),

    APP_URL: z.url("APP_URL muss eine gültige URL sein"),
    TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),

    API_DOCS_ENABLED: booleanString.optional(),
    LOG_LEVEL: z.enum(["error", "warn", "info", "http", "debug"]).optional(),

    /**
     * - resend: Versand über Resend (Produktion)
     * - smtp: an einen SMTP-Server, lokal z. B. Mailpit
     * - console: Mail nur ins Log schreiben
     * - memory: nur im Speicher sammeln (Tests)
     */
    MAIL_TRANSPORT: z.enum(["resend", "smtp", "console", "memory"]).optional(),
    MAIL_FROM: z.string().min(3).default("AthletePT <noreply@localhost>"),
    RESEND_API_KEY: z.string().min(1).optional(),
    SMTP_URL: z.url().default("smtp://localhost:1025"),
  })
  .superRefine((env, ctx) => {
    const credentialsInUri = /^mongodb(\+srv)?:\/\/[^/]*@/.test(env.MONGO_URI);
    if (env.NODE_ENV === "production" && !env.MONGO_USER && !credentialsInUri) {
      ctx.addIssue({
        code: "custom",
        path: ["MONGO_USER"],
        message: "In production nur mit Zugangsdaten (MONGO_USER/MONGO_PASSWORD oder in MONGO_URI)",
      });
    }
    if (env.MONGO_USER && !env.MONGO_PASSWORD) {
      ctx.addIssue({ code: "custom", path: ["MONGO_PASSWORD"], message: "MONGO_PASSWORD fehlt" });
    }
    const transport = env.MAIL_TRANSPORT ?? (env.NODE_ENV === "production" ? "resend" : "console");
    if (transport === "resend" && !env.RESEND_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["RESEND_API_KEY"],
        message: "RESEND_API_KEY fehlt (oder MAIL_TRANSPORT anders setzen)",
      });
    }
    if (env.NODE_ENV === "production" && (transport === "console" || transport === "memory")) {
      ctx.addIssue({
        code: "custom",
        path: ["MAIL_TRANSPORT"],
        message: "In production nur resend oder smtp erlaubt",
      });
    }
  })
  .transform((env) => ({
    ...env,
    isProduction: env.NODE_ENV === "production",
    isTest: env.NODE_ENV === "test",
    apiDocsEnabled: env.API_DOCS_ENABLED ?? env.NODE_ENV !== "production",
    logLevel: env.LOG_LEVEL ?? (env.NODE_ENV === "production" ? "info" : "debug"),
    mailTransport: env.MAIL_TRANSPORT ?? (env.NODE_ENV === "production" ? "resend" : "console"),
  }));

export type Env = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Ungültige Konfiguration:\n${issues.map((issue) => `  - ${issue}`).join("\n")}`);
    this.name = "EnvValidationError";
  }
}

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(
      result.error.issues.map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`),
    );
  }
  return result.data;
}

function loadEnv(): Env {
  // Lokale .env nur laden, wenn vorhanden. In Containern kommen die Werte aus der Umgebung.
  if (process.env.NODE_ENV !== "test" && existsSync(".env")) {
    process.loadEnvFile(".env");
  }
  return parseEnv(process.env);
}

export const env = loadEnv();
