import type { TransitService } from "@transit/core";
import type { ServerConfigResult } from "@/config/server-config";
import { handleApiRequest } from "@/http/handle-api-request";
import { parseDirectionId } from "@/http/params";
import { errorResponse, jsonResponse, NO_STORE } from "@/http/responses";
import { mapRouteVehiclesResult } from "@/mappers/route-vehicles";

export interface RouteVehiclesHandlerDeps {
  getService: () => TransitService;
  readConfig: () => ServerConfigResult;
}

export interface RouteVehiclesRouteContext {
  params: Promise<{ routeId: string }>;
}

export function createRouteVehiclesHandler(deps: RouteVehiclesHandlerDeps) {
  return async (request: Request, context: RouteVehiclesRouteContext): Promise<Response> => {
    return handleApiRequest(request, context, deps, async (request, context) => {
      const { routeId } = await context.params;
      const params = new URL(request.url).searchParams;

      const directionId = parseDirectionId(params);
      if (!directionId.ok) return errorResponse("invalid_request", directionId.message);

      const result = await deps.getService().getRouteVehicles(routeId, directionId.value);
      if (!result) return errorResponse("not_found", "Route not found.");

      return jsonResponse(mapRouteVehiclesResult(result), { cacheControl: NO_STORE });
    });
  };
}
