import { randomUUID } from "node:crypto";

import type { RequestHandler } from "express";

import { requestContext } from "../lib/logger/request-context";

const VALID_ID = /^[\w-]{8,64}$/;

/** Übernimmt eine gültige X-Request-ID vom Proxy oder erzeugt eine neue und gibt sie zurück. */
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.header("x-request-id");
  const id = incoming && VALID_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader("X-Request-ID", id);
  requestContext.run({ requestId: id }, next);
};
