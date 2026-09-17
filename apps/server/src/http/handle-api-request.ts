import { CatalogUnavailableError } from "@transit/gtfs";
import type { ServerConfigResult } from "../config/server-config";
import { hasValidApiKey } from "./auth";
import { errorResponse } from "./responses";

export interface HandleApiRequestDeps {
  readConfig: () => ServerConfigResult;
}

/**
 * Shared wrapper for every `/api/v1/*` endpoint (EPIC-001 section 11): read config,
 * authenticate, then run the handler. Catches `CatalogUnavailableError` (503
 * catalog_unavailable) and any other thrown error (500 internal_error, logged once
 * with no coordinates or API key). Does not apply to `/api/cron/*`, which doesn't
 * require `x-api-key` and has its own auth (a distinct header/secret).
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
