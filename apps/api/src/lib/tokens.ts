import { createHash, randomBytes } from "node:crypto";

/** Zufälliges, URL-taugliches Token mit 256 Bit Entropie. */
export function generateToken() {
  return randomBytes(32).toString("base64url");
}

/** Tokens werden nur gehasht gespeichert. Ein DB-Leak liefert so keine nutzbaren Tokens. */
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
