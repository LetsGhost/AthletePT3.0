import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { problemSchema } from "@athletept/shared";
import { z } from "zod";

export const API_PREFIX = "/api/v1";

/** Zentrale Registry. Jede Route trägt sich über `createModuleRouter` hier ein. */
export const registry = new OpenAPIRegistry();

/** Nur Routen, die mit API-Keys erreichbar sind (Doku für externe Apps). */
export const externalRegistry = new OpenAPIRegistry();

function registerComponents(target: OpenAPIRegistry, bearerFormat: string) {
  target.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    bearerFormat,
  });
  // Als fertiges JSON-Schema registriert: `registry.register` bräuchte `.openapi()` am Schema,
  // das zod 4 nur Schemas gibt, die nach `extendZodWithOpenApi` erzeugt wurden.
  return target.registerComponent(
    "schemas",
    "Problem",
    z.toJSONSchema(problemSchema, { target: "openapi-3.0" }) as never,
  ).ref;
}

export const ProblemRef = registerComponents(registry, "JWT");
registerComponents(externalRegistry, "API-Key (apt_…)");

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

let cachedExternalDocument: ReturnType<OpenApiGeneratorV31["generateDocument"]> | undefined;

/** Doku für Entwickler externer Apps: nur Routen mit `apiKeyScope`, auch in Produktion abrufbar. */
export function getExternalOpenApiDocument() {
  cachedExternalDocument ??= new OpenApiGeneratorV31(externalRegistry.definitions).generateDocument(
    {
      openapi: "3.1.0",
      info: {
        title: "AthletePT API für externe Apps",
        version: "1.0.0",
        description: [
          "Zugriff externer Apps im Namen eines Coaches oder Athleten.",
          "",
          "**Authentifizierung:** `Authorization: Bearer apt_…`. Den Key richtet der Sysadmin ein, der",
          "Nutzer holt ihn einmalig ab. Er gilt ein Jahr. Fehler: 401 `api_key_invalid`, `api_key_revoked`,",
          "`api_key_expired`.",
          "",
          "**Rechte:** Jede Route nennt ihren Bereich (z. B. `plans:write`). Fehlt er dem Key: 403",
          "`api_key_scope_missing`. Die App darf nie mehr als der Nutzer selbst; bei Athleten gelten",
          "zusätzlich die Freigaben des Coaches (`GET /me/permissions`). Nicht aufgeführte Routen sind für",
          "Keys gesperrt (403 `api_key_route_forbidden`).",
          "",
          "**Rate-Limit:** eigener Bucket pro Key (Standard 300 Anfragen je 15 Minuten), siehe Header",
          "`RateLimit`. Bei Überschreitung 429 `rate_limited`.",
          "",
          "**Gleichzeitige Änderungen:** Pläne und Trainings haben eine `revision`. Beim Speichern den",
          "zuletzt geladenen Stand mitschicken; hat sich inzwischen etwas geändert (z. B. in der Web-App),",
          "kommt 409. Dann neu laden und erneut speichern.",
          "",
          "**Sicherheit:** Den Key nie im Browser oder Quellcode ablegen. Bei Desktop-Apps (z. B. Electron)",
          "die Aufrufe im Hauptprozess machen und den Key verschlüsselt speichern (`safeStorage`). Für",
          "Aufrufe aus dem Browser sind nicht vorgesehen (keine CORS-Freigabe für fremde Origins).",
          "",
          "**Fehler** kommen als `application/problem+json` (RFC 9457) mit stabilem `code`.",
        ].join("\n"),
      },
    },
  );
  return cachedExternalDocument;
}
