import winston from "winston";
import { requestContext } from "./request-context";

const { combine, timestamp, printf, errors, json, colorize, metadata, splat } =
  winston.format;

const isProd = process.env.NODE_ENV === "production";

const devFormat = printf((info) => {
  const { level, message, timestamp, stack, requestId, label, ...rest } = info as any;
  // Extract remaining metadata excluding Winston internals
  const meta: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (typeof v === "undefined") continue;
    if (["level", "message", "timestamp"].includes(k)) continue;
    meta[k] = v;
  }

  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  const labelStr = label ? `[${label}] ` : "";
  const reqStr = `[${requestId ?? "no-req"}]`;
  return `[${timestamp}] ${level} ${labelStr}${reqStr}: ${stack || message}${metaStr}`;
});

const addRequestId = winston.format((info) => {
  const store = requestContext.getStore();
  if (store?.requestId) {
    info.requestId = store.requestId;
  }
  return info;
});

export const logger = winston.createLogger({
  level: isProd ? "info" : "debug",

  format: combine(
    addRequestId(),
    splat(),
    metadata(),
    errors({ stack: true }),
    timestamp(),
    isProd ? json() : devFormat
  ),

  transports: [
    new winston.transports.Console({
      format: isProd
        ? combine(addRequestId(), timestamp(), json())
        : combine(addRequestId(), colorize(), timestamp(), devFormat),
    }),

    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      format: combine(addRequestId(), timestamp(), json()),
    }),

    new winston.transports.File({
      filename: "logs/combined.log",
      format: combine(addRequestId(), timestamp(), json()),
    }),
  ],
});
