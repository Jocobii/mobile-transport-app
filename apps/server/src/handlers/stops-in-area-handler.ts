import type { TransitService } from "@transit/core";
import type { ServerConfigResult } from "@/config/server-config";
import { TRANSIT_SETTINGS } from "@/config/transit-settings";
import { handleApiRequest } from "@/http/handle-api-request";
import { parseBbox } from "@/http/parse-bbox";
import { CATALOG_CACHE, errorResponse, jsonResponse } from "@/http/responses";
import { mapStopsInAreaResult } from "@/mappers/stops-in-area";

export interface StopsInAreaHandlerDeps {
  getService: () => TransitService;
  readConfig: () => ServerConfigResult;
}

export function createStopsInAreaHandler(deps: StopsInAreaHandlerDeps) {
  return async (request: Request): Promise<Response> => {
    return handleApiRequest(request, {}, deps, async (request) => {
      const params = new URL(request.url).searchParams;

      const bbox = parseBbox(params, TRANSIT_SETTINGS.areaStopsMaxSpanDegrees);
      if (!bbox.ok) return errorResponse("invalid_request", bbox.message);

      const result = await deps.getService().getStopsInArea(bbox.value);
      return jsonResponse(mapStopsInAreaResult(result), { cacheControl: CATALOG_CACHE });
    });
  };
}
