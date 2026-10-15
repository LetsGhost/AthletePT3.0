import type { UserRole } from "@athletept/shared";

export interface AuthContext {
  userId: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}
