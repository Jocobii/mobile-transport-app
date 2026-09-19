import type { TransitService } from "@transit/core";
import type { ServerConfigResult } from "@/config/server-config";
import { TRANSIT_SETTINGS } from "@/config/transit-settings";
import { handleApiRequest } from "@/http/handle-api-request";
import { parseBbox } from "@/http/parse-bbox";
import { errorResponse, jsonResponse, NO_STORE } from "@/http/responses";
import { mapVehiclesInAreaResult } from "@/mappers/vehicles-in-area";

export interface VehiclesInAreaHandlerDeps {
  getService: () => TransitService;
  readConfig: () => ServerConfigResult;
}

export function createVehiclesInAreaHandler(deps: VehiclesInAreaHandlerDeps) {
  return async (request: Request): Promise<Response> => {
    return handleApiRequest(request, {}, deps, async (request) => {
      const params = new URL(request.url).searchParams;

      const bbox = parseBbox(params, TRANSIT_SETTINGS.areaVehiclesMaxSpanDegrees);
      if (!bbox.ok) return errorResponse("invalid_request", bbox.message);

      const result = await deps.getService().getVehiclesInArea(bbox.value);
      return jsonResponse(mapVehiclesInAreaResult(result), { cacheControl: NO_STORE });
    });
  };
}
