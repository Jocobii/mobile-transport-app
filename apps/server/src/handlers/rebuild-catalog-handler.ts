import type { ServerConfigResult } from "@/config/server-config";
import { hasValidBearerToken } from "@/http/auth";
import { errorResponse, jsonResponse, NO_STORE } from "@/http/responses";

const DEPLOY_HOOK_TIMEOUT_MS = 10_000;

export interface RebuildCatalogHandlerDeps {
  readConfig: () => ServerConfigResult;
  /** Injectable for tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

/**
 * Vercel cron entry point (EPIC-001 §11): triggers a rebuild of the static catalog by
 * calling the project's deploy hook. Does not require `x-api-key`; auth is a bearer
 * `CRON_SECRET` set by Vercel's cron scheduler.
 */
export function createRebuildCatalogHandler(deps: RebuildCatalogHandlerDeps) {
  return async (request: Request): Promise<Response> => {
    const configResult = deps.readConfig();
    if (!configResult.ok) {
      return errorResponse(
        "server_misconfigured",
        `Missing required environment variables: ${configResult.missing.join(", ")}`,
      );
    }

    const { cronSecret, catalogDeployHookUrl } = configResult.config;
    const missing: string[] = [];
    if (!cronSecret) missing.push("CRON_SECRET");
    if (!catalogDeployHookUrl) missing.push("CATALOG_DEPLOY_HOOK_URL");
    if (missing.length > 0) {
      return errorResponse(
        "server_misconfigured",
        `Missing required environment variables: ${missing.join(", ")}`,
      );
    }

    if (!hasValidBearerToken(request, cronSecret)) {
      return errorResponse("unauthorized", "Invalid or missing cron authorization header.");
    }

    const fetchImpl = deps.fetchImpl ?? fetch;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEPLOY_HOOK_TIMEOUT_MS);

    try {
      const response = await fetchImpl(catalogDeployHookUrl, {
        method: "POST",
        signal: controller.signal,
      });
      if (!response.ok) {
        return jsonResponse(
          { error: { code: "internal_error", message: `Deploy hook responded with HTTP ${response.status}.` } },
          { status: 502, cacheControl: NO_STORE },
        );
      }
      return jsonResponse({ triggered: true }, { cacheControl: NO_STORE });
    } catch (err) {
      console.error("Failed to call the catalog deploy hook:", err);
      return jsonResponse(
        { error: { code: "internal_error", message: "Failed to call the catalog deploy hook." } },
        { status: 502, cacheControl: NO_STORE },
      );
    } finally {
      clearTimeout(timeout);
    }
  };
}
