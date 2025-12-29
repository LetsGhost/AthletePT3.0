import winston from "winston";
import { requestContext } from "./request-context";

const { combine, timestamp, printf, errors, json, colorize } =
  winston.format;

const isProd = process.env.NODE_ENV === "production";

const devFormat = printf(({ level, message, timestamp, stack, requestId }) => {
  return `[${timestamp}] ${level} [${requestId ?? "no-req"}]: ${
    stack || message
  }`;
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
