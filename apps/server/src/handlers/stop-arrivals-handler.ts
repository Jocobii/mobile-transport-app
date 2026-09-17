import type { TransitService } from "@transit/core";
import type { ServerConfigResult } from "@/config/server-config";
import { handleApiRequest } from "@/http/handle-api-request";
import { parsePathId } from "@/http/params";
import { errorResponse, jsonResponse, NO_STORE } from "@/http/responses";
import { mapStopArrivalsResult } from "@/mappers/stop-arrivals";

const MAX_STOP_ID_LENGTH = 100;

export interface StopArrivalsHandlerDeps {
  getService: () => TransitService;
  readConfig: () => ServerConfigResult;
}

export interface StopArrivalsRouteContext {
  params: Promise<{ stopId: string }>;
}

export function createStopArrivalsHandler(deps: StopArrivalsHandlerDeps) {
  return async (request: Request, context: StopArrivalsRouteContext): Promise<Response> => {
    return handleApiRequest(request, context, deps, async (_request, context) => {
      const { stopId: rawStopId } = await context.params;
      const stopId = parsePathId(rawStopId, MAX_STOP_ID_LENGTH);
      if (!stopId.ok) return errorResponse("invalid_request", stopId.message);

      const result = await deps.getService().getStopArrivals(stopId.value);
      if (!result) return errorResponse("not_found", "Stop not found.");

      return jsonResponse(mapStopArrivalsResult(result), { cacheControl: NO_STORE });
    });
  };
}
