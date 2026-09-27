import { CatalogUnavailableError } from "@transit/gtfs";
import type { ServerConfigResult } from "@/config/server-config";
import { checkAccess } from "./access";
import { hasValidApiKey } from "./auth";
import { readClientIdentity } from "./client-identity";
import { errorResponse } from "./responses";

export interface HandleApiRequestDeps {
  readConfig: () => ServerConfigResult;
}

/**
 * Shared wrapper for every `/api/v1/*` endpoint (EPIC-001 section 11): read config,
 * authenticate, check access (EPIC-010), then run the handler. A request rejected by
 * `checkAccess` (blocked or not on the allow-list) gets `403 access_denied` and the handler
 * is never called. Catches `CatalogUnavailableError` (503 catalog_unavailable) and any other
 * thrown error (500 internal_error, logged once with no coordinates or API key). Does not
 * apply to `/api/cron/*`, which doesn't require `x-api-key` and has its own auth (a distinct
 * header/secret).
 */
export async function handleApiRequest<Context>(
  request: Request,
  context: Context,
  deps: HandleApiRequestDeps,
  run: (request: Request, context: Context) => Promise<Response>,
): Promise<Response> {
  const configResult = deps.readConfig();
  if (!configResult.ok) {
    console.error("Server misconfigured: missing environment variables", configResult.missing);
    return errorResponse("server_misconfigured", "The server is not configured.");
  }

  if (!hasValidApiKey(request, configResult.config.apiKey)) {
    return errorResponse("unauthorized", "Missing or invalid API key.");
  }

  const identity = readClientIdentity(request);
  const access = checkAccess(identity, configResult.config);
  if (!access.ok) {
    // TODO(EPIC-009): replace with Logger port + http.access_denied event once EPIC-009 lands.
    console.warn(
      JSON.stringify({
        event: "http.access_denied",
        path: new URL(request.url).pathname,
        reason: access.reason,
        ...(identity.userName !== undefined ? { user: identity.userName } : {}),
        ...(identity.installId !== undefined ? { installId: identity.installId } : {}),
      }),
    );
    return errorResponse("access_denied", "Access to this app has been disabled.");
  }

  try {
    return await run(request, context);
  } catch (err) {
    if (err instanceof CatalogUnavailableError) {
      return errorResponse(
        "catalog_unavailable",
        "The transit catalog is temporarily unavailable.",
      );
    }
    console.error("Unexpected error handling API request:", err);
    return errorResponse("internal_error", "An unexpected error occurred.");
  }
}
