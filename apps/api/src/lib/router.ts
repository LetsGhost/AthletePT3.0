import type { RouteConfig, ResponseConfig } from "@asteasolutions/zod-to-openapi";
import type { UserRole } from "@athletept/shared";
import { Router, type Request, type RequestHandler, type Response } from "express";
import type { ZodObject, ZodType, z } from "zod";

import { authenticate, requireRole } from "../middleware/authenticate";
import type { AuthContext } from "../types/express";
import { API_PREFIX, ProblemRef, registry } from "./openapi";
import { parseOrThrow } from "./validation";

type Method = "get" | "post" | "put" | "patch" | "delete";

/**
 * - `false`: öffentlich
 * - `"any"`: jede angemeldete Rolle
 * - Rollenliste: nur diese Rollen
 */
type AuthSpec = false | "any" | readonly UserRole[];

type Output<S> = S extends ZodType ? z.output<S> : undefined;

export interface HandlerContext<A extends AuthSpec, B, Q, P> {
  req: Request;
  res: Response;
  body: Output<B>;
  query: Output<Q>;
  params: Output<P>;
  auth: A extends false ? null : AuthContext;
}

export interface RouteDefinition<
  A extends AuthSpec,
  B extends ZodType | undefined,
  Q extends ZodObject | undefined,
  P extends ZodObject | undefined,
> {
  method: Method;
  /** Pfad relativ zum Modul, im Express-Format (`/:id`). */
  path: string;
  summary: string;
  description?: string;
  auth: A;
  body?: B;
  query?: Q;
  params?: P;
  /** Erfolgsstatus, Default 200. Bei 204 wird kein Body gesendet. */
  status?: number;
  response?: ZodType;
  responseDescription?: string;
  /** Zusätzlich dokumentierte Fehlerstatus. 400/401/403 werden automatisch ergänzt. */
  errors?: number[];
  middleware?: RequestHandler[];
  handler: (ctx: HandlerContext<A, B, Q, P>) => unknown;
}

const errorDescriptions: Record<number, string> = {
  400: "Ungültige Anfrage",
  401: "Nicht angemeldet",
  403: "Keine Berechtigung",
  404: "Nicht gefunden",
  409: "Konflikt",
  429: "Zu viele Anfragen",
};

function toOpenApiPath(path: string) {
  return path.replace(/:(\w+)/g, "{$1}");
}

/**
 * Erzeugt einen Router für ein Modul. Jede Route wird validiert, autorisiert und
 * gleichzeitig in der OpenAPI-Doku registriert, damit Doku und Code nicht auseinanderlaufen.
 */
export function createModuleRouter(prefix: string, tag: string) {
  const router = Router();

  function route<
    A extends AuthSpec,
    B extends ZodType | undefined = undefined,
    Q extends ZodObject | undefined = undefined,
    P extends ZodObject | undefined = undefined,
  >(def: RouteDefinition<A, B, Q, P>) {
    const status = def.status ?? 200;
    const guards: RequestHandler[] = [];
    if (def.auth !== false) {
      guards.push(authenticate);
      if (def.auth !== "any") {
        guards.push(requireRole(...(def.auth as readonly UserRole[])));
      }
    }

    const handler: RequestHandler = async (req, res) => {
      const ctx = {
        req,
        res,
        body: def.body ? parseOrThrow(def.body, req.body ?? {}) : undefined,
        query: def.query ? parseOrThrow(def.query, req.query) : undefined,
        params: def.params ? parseOrThrow(def.params, req.params) : undefined,
        auth: def.auth === false ? null : req.auth,
      } as HandlerContext<A, B, Q, P>;

      const result = await def.handler(ctx);
      if (res.headersSent) return;
      if (status === 204 || result === undefined) {
        res.status(status === 200 ? 204 : status).end();
        return;
      }
      res.status(status).json(result);
    };

    router[def.method](def.path, ...guards, ...(def.middleware ?? []), handler);

    registerOpenApi(prefix, tag, def, status);
  }

  return { prefix, router, route };
}

function registerOpenApi(
  prefix: string,
  tag: string,
  def: RouteDefinition<AuthSpec, ZodType | undefined, ZodObject | undefined, ZodObject | undefined>,
  status: number,
) {
  const responses: Record<string, ResponseConfig> = {
    [status]: {
      description:
        def.responseDescription ?? (status === 204 ? "Erfolgreich, ohne Inhalt" : "Erfolgreich"),
      ...(def.response && status !== 204
        ? { content: { "application/json": { schema: def.response } } }
        : {}),
    },
  };

  const errorStatuses = new Set(def.errors ?? []);
  if (def.body || def.query || def.params) errorStatuses.add(400);
  if (def.auth !== false) errorStatuses.add(401);
  if (Array.isArray(def.auth)) errorStatuses.add(403);
  for (const code of [...errorStatuses].sort()) {
    responses[code] = {
      description: errorDescriptions[code] ?? "Fehler",
      content: { "application/problem+json": { schema: ProblemRef } },
    };
  }

  const config: RouteConfig = {
    method: def.method,
    path: toOpenApiPath(`${API_PREFIX}${prefix}${def.path === "/" ? "" : def.path}`),
    summary: def.summary,
    description: Array.isArray(def.auth)
      ? [def.description, `Rollen: ${def.auth.join(", ")}`].filter(Boolean).join("\n\n")
      : def.description,
    tags: [tag],
    security: def.auth === false ? [] : [{ bearerAuth: [] }],
    request: {
      ...(def.params ? { params: def.params } : {}),
      ...(def.query ? { query: def.query } : {}),
      ...(def.body ? { body: { content: { "application/json": { schema: def.body } } } } : {}),
    },
    responses,
  };
  registry.registerPath(config);
}
