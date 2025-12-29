import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../modules/common/auth/jwt";
import { isAuthBypassEnabled, getDevUser } from "../utils/auth/auth-bypass.utils";
import { logger } from "../modules/common/logger/logger";

export interface AuthRequest extends Request {
  user?: { id: string; role: string };
}

export function authenticate(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) {
  try {
    if (isAuthBypassEnabled()) {
      req.user = getDevUser();
      logger.warn("⚠️  Auth bypass enabled - using dev user");
      return next();
    }

    const auth = req.headers.authorization;
    if (!auth) throw new Error("Unauthorized");

    const token = auth.split(" ")[1];
    const payload = verifyToken(token);

    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (error) {
    next(error);
  }
}