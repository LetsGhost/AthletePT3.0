import { describe, expect, it } from "vitest";

import { changePasswordRequestSchema, loginRequestSchema } from "./auth";
import { objectIdSchema } from "./common";

describe("loginRequestSchema", () => {
  it("normalisiert die E-Mail", () => {
    const result = loginRequestSchema.parse({ email: "  Max@Example.COM ", password: "x" });

    expect(result.email).toBe("max@example.com");
  });
});

describe("changePasswordRequestSchema", () => {
  it("verlangt mindestens 10 Zeichen", () => {
    const result = changePasswordRequestSchema.safeParse({
      currentPassword: "altes-passwort",
      newPassword: "zu-kurz",
    });

    expect(result.success).toBe(false);
  });

  it("lehnt ein unverändertes Passwort ab", () => {
    const result = changePasswordRequestSchema.safeParse({
      currentPassword: "gleiches-passwort",
      newPassword: "gleiches-passwort",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["newPassword"]);
  });
});

describe("objectIdSchema", () => {
  it("akzeptiert nur 24-stellige Hex-IDs", () => {
    expect(objectIdSchema.safeParse("6acd3920c0072ec254663bd8").success).toBe(true);
    expect(objectIdSchema.safeParse("6acd3920c0072ec254663bdZ").success).toBe(false);
    expect(objectIdSchema.safeParse("123").success).toBe(false);
  });
});
