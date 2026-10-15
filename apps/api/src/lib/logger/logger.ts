import winston from "winston";

import { env } from "../../config/env";
import { requestContext } from "./request-context";

const { combine, timestamp, printf, errors, json, colorize, splat } = winston.format;

const devFormat = printf((info) => {
  const { level, message, timestamp, stack, requestId, label, ...rest } =
    info as winston.Logform.TransformableInfo;
  // Extract remaining metadata excluding Winston internals
  const meta: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (typeof v === "undefined") continue;
    meta[k] = v;
  }

  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  const labelStr = label ? `[${String(label)}] ` : "";
  const reqStr = requestId ? `[${String(requestId)}] ` : "";
  return `[${String(timestamp)}] ${level} ${labelStr}${reqStr}${String(stack ?? message)}${metaStr}`;
});

const addRequestId = winston.format((info) => {
  const store = requestContext.getStore();
  if (store?.requestId) {
    info.requestId = store.requestId;
  }
  return info;
});

// Nur auf die Konsole loggen. Sammeln und Rotieren übernimmt die Laufzeitumgebung (Docker, systemd).
export const logger = winston.createLogger({
  level: env.logLevel,
  silent: env.isTest,
  format: combine(addRequestId(), splat(), errors({ stack: true }), timestamp()),
  transports: [
    new winston.transports.Console({
      format: env.isProduction ? json() : combine(colorize(), devFormat),
    }),
  ],
});
