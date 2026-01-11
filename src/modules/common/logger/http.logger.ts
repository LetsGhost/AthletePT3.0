import morgan from "morgan";
import { logger } from "./logger";

// Structured HTTP logs with level based on status code and clear metadata
export const httpLogger = morgan((tokens, req, res) => {
  const status = Number(tokens.status(req, res));
  const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";

  const log = logger.child({ label: "http" });
  log.log(level, `${tokens.method(req, res)} ${tokens.url(req, res)}`, {
    status,
    durationMs: Number(tokens["response-time"](req, res)),
    length: tokens.res(req, res, "content-length") || 0,
    remote: tokens["remote-addr"](req, res),
    userAgent: tokens["user-agent"](req, res),
  });

  // Morgan expects a string; returning undefined prevents default output
  return undefined as unknown as string;
});
