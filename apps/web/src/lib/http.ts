import type { FieldError, Problem } from "@athletept/shared";

export const API_BASE = "/api/v1";

/** Fehler aus einer API-Antwort (Problem Details) oder ein Netzwerkfehler (`status` 0). */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly errors: FieldError[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }

  static fromProblem(problem: Partial<Problem>, status: number) {
    return new ApiError(
      problem.status ?? status,
      problem.code ?? "unknown_error",
      problem.detail ?? problem.title ?? "Unbekannter Fehler",
      problem.errors ?? [],
    );
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/** Einfacher Request ohne Auth-Logik. Wirft `ApiError` bei jedem Nicht-2xx-Status. */
export async function rawRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json", ...options.headers };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let response: Response;
  try {
    response = await fetch(new URL(`${API_BASE}${path}`, window.location.origin), {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: "same-origin",
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(
      0,
      "network_error",
      "Keine Verbindung zum Server. Bitte prüfe dein Internet.",
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const isJson = response.headers.get("content-type")?.includes("json") ?? false;
  const payload: unknown = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    throw ApiError.fromProblem((payload ?? {}) as Partial<Problem>, response.status);
  }
  return payload as T;
}

/** Nutzerfreundliche Fehlermeldung für beliebige Fehler. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status >= 500)
      return "Auf dem Server ist ein Fehler aufgetreten. Bitte versuche es später erneut.";
    return error.message;
  }
  return "Etwas ist schiefgelaufen. Bitte versuche es erneut.";
}
