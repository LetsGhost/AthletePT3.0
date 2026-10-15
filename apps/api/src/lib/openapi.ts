import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { problemSchema } from "@athletept/shared";
import { z } from "zod";

export const API_PREFIX = "/api/v1";

/** Zentrale Registry. Jede Route trägt sich über `createModuleRouter` hier ein. */
export const registry = new OpenAPIRegistry();

registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});

// Als fertiges JSON-Schema registriert: `registry.register` bräuchte `.openapi()` am Schema,
// das zod 4 nur Schemas gibt, die nach `extendZodWithOpenApi` erzeugt wurden.
export const ProblemRef = registry.registerComponent(
  "schemas",
  "Problem",
  z.toJSONSchema(problemSchema, { target: "openapi-3.0" }) as never,
).ref;

let cachedDocument: ReturnType<OpenApiGeneratorV31["generateDocument"]> | undefined;

export function getOpenApiDocument() {
  cachedDocument ??= new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: "3.1.0",
    info: {
      title: "AthletePT API",
      version: "1.0.0",
      description: [
        "REST-API für AthletePT.",
        "",
        "**Authentifizierung:** `POST /auth/login` liefert ein kurzlebiges Access-Token (Bearer) und setzt ein",
        "httpOnly-Cookie mit dem Refresh-Token. `POST /auth/refresh` erneuert beide.",
        "",
        "**Fehler** werden einheitlich als `application/problem+json` (RFC 9457) mit einem stabilen `code` geliefert.",
      ].join("\n"),
    },
  });
  return cachedDocument;
}
