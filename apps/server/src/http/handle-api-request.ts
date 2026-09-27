import { CatalogUnavailableError } from "@transit/gtfs";
import type { ServerConfigResult } from "@/config/server-config";
import { checkAccess } from "./access";
import { hasValidApiKey } from "./auth";
import { type ClientIdentity, readClientIdentity } from "./client-identity";
import { errorResponse } from "./responses";

export interface HandleApiRequestDeps {
  readConfig: () => ServerConfigResult;
}

/**
 * Logs one JSON line per request outcome (path, status, identity when sent). Interim
 * console.log/console.warn only — never coordinates or the API key.
 * TODO(EPIC-009): replace with the Logger port + proper http.request/http.access_denied
 * events once EPIC-009 lands.
 */
function logRequest(params: {
  path: string;
  status: number;
  identity: ClientIdentity;
  event?: string;
  reason?: string;
}): void {
  const { path, status, identity, event = "http.request", reason } = params;
  const line = JSON.stringify({
    event,
    path,
    status,
    ...(reason !== undefined ? { reason } : {}),
    ...(identity.userName !== undefined ? { user: identity.userName } : {}),
    ...(identity.installId !== undefined ? { installId: identity.installId } : {}),
  });
  if (event === "http.access_denied") {
    console.warn(line);
  } else {
    console.log(line);
  }
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
  const path = new URL(request.url).pathname;

  const configResult = deps.readConfig();
  if (!configResult.ok) {
    console.error("Server misconfigured: missing environment variables", configResult.missing);
    return errorResponse("server_misconfigured", "The server is not configured.");
  }

  const identity = readClientIdentity(request);

  if (!hasValidApiKey(request, configResult.config.apiKey)) {
    logRequest({ path, status: 401, identity });
    return errorResponse("unauthorized", "Missing or invalid API key.");
  }

  const access = checkAccess(identity, configResult.config);
  if (!access.ok) {
    logRequest({ path, status: 403, identity, event: "http.access_denied", reason: access.reason });
    return errorResponse("access_denied", "Access to this app has been disabled.");
  }

  try {
    const response = await run(request, context);
    logRequest({ path, status: response.status, identity });
    return response;
  } catch (err) {
    if (err instanceof CatalogUnavailableError) {
      logRequest({ path, status: 503, identity });
      return errorResponse(
        "catalog_unavailable",
        "The transit catalog is temporarily unavailable.",
      );
    }
    console.error("Unexpected error handling API request:", err);
    logRequest({ path, status: 500, identity });
    return errorResponse("internal_error", "An unexpected error occurred.");
  }
}
