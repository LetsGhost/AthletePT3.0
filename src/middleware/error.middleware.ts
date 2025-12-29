import { Request, Response, NextFunction } from "express";
import { logger } from "../modules/common/logger/logger";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  logger.error(err.message, {
    method: req.method,
    path: req.path,
    stack: err.stack,
  });

  res.status(400).json({ message: err.message });
};
