import { env } from "../../config/env";
import { verifyToken } from "../../modules/common/auth/jwt";

export const isAuthBypassEnabled = () => {
  return env.NODE_ENV === "development" && env.BYPASS_AUTH === "true";
};

export const getDevUser = (token?: string) => {
  if (token) {
    try {
      const payload = verifyToken(token);
      return { id: payload.sub, role: payload.role };
    } catch {
      void 0;
    }
  }
  
  return {
    id: "000000000000000000000000", // Valid ObjectId format
    role: "admin",
  };
};