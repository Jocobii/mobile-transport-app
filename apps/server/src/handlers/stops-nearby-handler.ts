import type { TransitService } from "@transit/core";
import type { ServerConfigResult } from "@/config/server-config";
import { TRANSIT_SETTINGS } from "@/config/transit-settings";
import { handleApiRequest } from "@/http/handle-api-request";
import { parseLatLon, parseRadius } from "@/http/params";
import { errorResponse, jsonResponse, NO_STORE } from "@/http/responses";
import { mapNearbyResult } from "@/mappers/nearby";

export interface StopsNearbyHandlerDeps {
  getService: () => TransitService;
  readConfig: () => ServerConfigResult;
}

export function createStopsNearbyHandler(deps: StopsNearbyHandlerDeps) {
  return async (request: Request): Promise<Response> => {
    return handleApiRequest(request, {}, deps, async (request) => {
      const params = new URL(request.url).searchParams;

      const latLon = parseLatLon(params);
      if (!latLon.ok) return errorResponse("invalid_request", latLon.message);

      const radius = parseRadius(params, TRANSIT_SETTINGS);
      if (!radius.ok) return errorResponse("invalid_request", radius.message);

      const result = await deps.getService().getNearby(latLon.value, radius.value);
      return jsonResponse(mapNearbyResult(result), { cacheControl: NO_STORE });
    });
  };
}
