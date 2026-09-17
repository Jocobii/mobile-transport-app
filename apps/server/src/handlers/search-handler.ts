import type { TransitService } from "@transit/core";
import type { ServerConfigResult } from "@/config/server-config";
import { TRANSIT_SETTINGS } from "@/config/transit-settings";
import { CATALOG_CACHE, errorResponse, jsonResponse } from "@/http/responses";
import { handleApiRequest } from "@/http/handle-api-request";
import { parseSearchQuery } from "@/http/params";
import { mapSearchResult } from "@/mappers/search";

export interface SearchHandlerDeps {
  getService: () => TransitService;
  readConfig: () => ServerConfigResult;
}

export function createSearchHandler(deps: SearchHandlerDeps) {
  return async (request: Request): Promise<Response> => {
    return handleApiRequest(request, {}, deps, async (request) => {
      const params = new URL(request.url).searchParams;

      const query = parseSearchQuery(params, TRANSIT_SETTINGS);
      if (!query.ok) return errorResponse("invalid_request", query.message);

      const result = await deps.getService().search(query.value);
      return jsonResponse(mapSearchResult(result), { cacheControl: CATALOG_CACHE });
    });
  };
}
