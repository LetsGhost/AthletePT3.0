import type { ApiKeyScope, UserRole } from "@athletept/shared";

export interface AuthContext {
  userId: string;
  role: UserRole;
  /** Gesetzt, wenn der Request mit einem API-Key statt einer Login-Sitzung kommt. */
  apiKey?: {
    id: string;
    scopes: ApiKeyScope[];
    /** Requests je 15 Minuten. */
    rateLimit: number;
  };
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}
