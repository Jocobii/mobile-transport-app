import { readServerConfig } from "../../../../src/config/server-config";
import { getHealth } from "../../../../src/health/get-health";
import { hasValidApiKey } from "../../../../src/http/auth";
import { errorResponse, jsonResponse, NO_STORE } from "../../../../src/http/responses";

export async function GET(request: Request): Promise<Response> {
  const configResult = readServerConfig();
  if (!configResult.ok) {
    console.error("Server misconfigured: missing environment variables", configResult.missing);
    return errorResponse("server_misconfigured", "The server is not configured.");
  }

  if (!hasValidApiKey(request, configResult.config.apiKey)) {
    return errorResponse("unauthorized", "Missing or invalid API key.");
  }

  const nowEpochSeconds = Math.floor(Date.now() / 1000);
  return jsonResponse(getHealth(nowEpochSeconds), { cacheControl: NO_STORE });
}
