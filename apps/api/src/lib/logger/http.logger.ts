import type { RequestHandler } from "express";

import { logger } from "./logger";

const log = logger.child({ label: "http" });

// Structured HTTP logs with level based on status code and clear metadata
export const httpLogger: RequestHandler = (req, res, next) => {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const status = res.statusCode;
    const level = status >= 500 ? "error" : status >= 400 ? "warn" : "http";
    // Nur den Pfad loggen: Query-Strings können Tokens enthalten (z. B. Einladungslinks).
    log.log(level, `${req.method} ${req.originalUrl.split("?")[0]}`, {
      status,
      durationMs: Number((process.hrtime.bigint() - start) / 1_000_000n),
      length: res.getHeader("content-length") ?? 0,
    });
  });
  next();
};
