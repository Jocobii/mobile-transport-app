import type { TransitService } from "@transit/core";
import type { ServerConfigResult } from "@/config/server-config";
import { handleApiRequest } from "@/http/handle-api-request";
import { parsePathId } from "@/http/params";
import { errorResponse, jsonResponse, NO_STORE } from "@/http/responses";
import { mapVehicleDetailResult } from "@/mappers/vehicle-detail";

const MAX_VEHICLE_ID_LENGTH = 100;

export interface VehicleDetailHandlerDeps {
  getService: () => TransitService;
  readConfig: () => ServerConfigResult;
}

export interface VehicleDetailRouteContext {
  params: Promise<{ vehicleId: string }>;
}

export function createVehicleDetailHandler(deps: VehicleDetailHandlerDeps) {
  return async (request: Request, context: VehicleDetailRouteContext): Promise<Response> => {
    return handleApiRequest(request, context, deps, async (_request, context) => {
      const { vehicleId: rawVehicleId } = await context.params;
      const vehicleId = parsePathId(rawVehicleId, MAX_VEHICLE_ID_LENGTH);
      if (!vehicleId.ok) return errorResponse("invalid_request", vehicleId.message);

      const result = await deps.getService().getVehicleDetail(vehicleId.value);
      if (!result) return errorResponse("not_found", "Vehicle not found.");

      return jsonResponse(mapVehicleDetailResult(result), { cacheControl: NO_STORE });
    });
  };
}
