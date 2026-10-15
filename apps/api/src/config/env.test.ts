import { describe, expect, it } from "vitest";

import { EnvValidationError, parseEnv } from "./env";

const valid = {
  MONGO_URI: "mongodb://localhost:27017/test",
  MONGO_USER: "athletept",
  MONGO_PASSWORD: "geheim",
  JWT_SECRET: "x".repeat(32),
  APP_URL: "https://app.example.com",
  RESEND_API_KEY: "re_test",
};

describe("parseEnv", () => {
  it("nimmt ohne NODE_ENV production an und schaltet die API-Doku ab", () => {
    const env = parseEnv(valid);

    expect(env.NODE_ENV).toBe("production");
    expect(env.isProduction).toBe(true);
    expect(env.apiDocsEnabled).toBe(false);
  });

  it("lehnt ein zu kurzes JWT_SECRET ab", () => {
    expect(() => parseEnv({ ...valid, JWT_SECRET: "y12345" })).toThrow(EnvValidationError);
  });

  it("verlangt MONGO_URI und APP_URL", () => {
    try {
      parseEnv({ JWT_SECRET: valid.JWT_SECRET });
      expect.unreachable();
    } catch (error) {
      expect((error as EnvValidationError).issues.join("\n")).toMatch(/MONGO_URI[\s\S]*APP_URL/);
    }
  });

  it("verlangt in production Zugangsdaten für MongoDB", () => {
    const { MONGO_USER: _user, MONGO_PASSWORD: _password, ...withoutAuth } = valid;
    expect(() => parseEnv(withoutAuth)).toThrow(/MONGO_USER/);
    expect(() => parseEnv({ ...valid, MONGO_PASSWORD: undefined })).toThrow(/MONGO_PASSWORD/);
    expect(
      parseEnv({ ...withoutAuth, MONGO_URI: "mongodb://app:pw@mongo:27017/athletept" }).MONGO_URI,
    ).toContain("app:pw@");
    expect(parseEnv({ ...withoutAuth, NODE_ENV: "development" }).MONGO_USER).toBeUndefined();
  });

  it("nutzt in production Resend und verlangt dafür einen API-Key", () => {
    expect(parseEnv(valid).mailTransport).toBe("resend");
    expect(() => parseEnv({ ...valid, RESEND_API_KEY: undefined })).toThrow(EnvValidationError);
  });

  it("verbietet in production Mails nur ins Log zu schreiben", () => {
    expect(() => parseEnv({ ...valid, MAIL_TRANSPORT: "console" })).toThrow(EnvValidationError);
  });

  it("schreibt Mails in der Entwicklung ohne Konfiguration ins Log", () => {
    const { RESEND_API_KEY: _unused, ...withoutKey } = valid;
    expect(parseEnv({ ...withoutKey, NODE_ENV: "development" }).mailTransport).toBe("console");
  });

  it("zerlegt CORS_ORIGINS und prüft jede URL", () => {
    expect(parseEnv({ ...valid, CORS_ORIGINS: "https://a.de, https://b.de" }).CORS_ORIGINS).toEqual(
      ["https://a.de", "https://b.de"],
    );
    expect(() => parseEnv({ ...valid, CORS_ORIGINS: "kein-url" })).toThrow(EnvValidationError);
  });
});
