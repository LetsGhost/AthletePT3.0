import bcrypt from "bcryptjs";

const COST = 12;

// Wird verglichen, wenn es den User nicht gibt. So dauert ein Login mit unbekannter
// E-Mail genauso lange wie mit falschem Passwort (keine User-Enumeration über Timing).
const DUMMY_HASH = bcrypt.hashSync("athletept-timing-dummy", COST);

export function hashPassword(password: string) {
  return bcrypt.hash(password, COST);
}

export async function verifyPassword(password: string, hash: string | null | undefined) {
  if (!hash) {
    await bcrypt.compare(password, DUMMY_HASH);
    return false;
  }
  return bcrypt.compare(password, hash);
}
