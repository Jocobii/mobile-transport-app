import type { TransitService } from "@transit/core";
import type { ServerConfigResult } from "@/config/server-config";
import { handleApiRequest } from "@/http/handle-api-request";
import { jsonResponse, NO_STORE } from "@/http/responses";
import { mapHealthResult } from "@/mappers/health";

export interface HealthHandlerDeps {
  getService: () => TransitService;
  readConfig: () => ServerConfigResult;
}

export function createHealthHandler(deps: HealthHandlerDeps) {
  return async (request: Request): Promise<Response> => {
    return handleApiRequest(request, {}, deps, async () => {
      const result = await deps.getService().getHealth();
      return jsonResponse(mapHealthResult(result), { cacheControl: NO_STORE });
    });
  };
}
