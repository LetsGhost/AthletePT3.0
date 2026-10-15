import { refreshSession, sessionExpired, useSession } from "@/features/auth/session";

import { ApiError, rawRequest, type RequestOptions } from "./http";

const RETRYABLE_AUTH_CODES = new Set([
  "token_expired",
  "token_revoked",
  "invalid_token",
  "unauthorized",
]);

function withAuth(options: RequestOptions): RequestOptions {
  const token = useSession.getState().accessToken;
  return token
    ? { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` } }
    : options;
}

/**
 * Authentifizierter API-Request. Bei abgelaufenem Access-Token wird die Sitzung einmal
 * erneuert und der Request wiederholt.
 */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await rawRequest<T>(path, withAuth(options));
  } catch (error) {
    if (
      !(error instanceof ApiError) ||
      error.status !== 401 ||
      !RETRYABLE_AUTH_CODES.has(error.code)
    ) {
      throw error;
    }
  }

  const refreshed = await refreshSession();
  if (!refreshed) {
    sessionExpired();
    throw new ApiError(
      401,
      "session_expired",
      "Deine Sitzung ist abgelaufen. Bitte melde dich neu an.",
    );
  }
  return rawRequest<T>(path, withAuth(options));
}
