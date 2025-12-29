import { NextFunction, Response } from "express";
import { AuthRequest } from "./auth.middleware";

export const authorize =
  (...roles: string[]) =>
  (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new Error("Forbidden");
    }
    next();
  };
