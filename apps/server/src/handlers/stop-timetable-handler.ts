import type { TransitService } from "@transit/core";
import type { ServerConfigResult } from "@/config/server-config";
import { handleApiRequest } from "@/http/handle-api-request";
import { parsePathId, parseServiceDateParam } from "@/http/params";
import { CATALOG_CACHE, errorResponse, jsonResponse } from "@/http/responses";
import { mapStopTimetableResult } from "@/mappers/stop-timetable";

const MAX_STOP_ID_LENGTH = 100;

export interface StopTimetableHandlerDeps {
  getService: () => TransitService;
  readConfig: () => ServerConfigResult;
}

export interface StopTimetableRouteContext {
  params: Promise<{ stopId: string }>;
}

export function createStopTimetableHandler(deps: StopTimetableHandlerDeps) {
  return async (request: Request, context: StopTimetableRouteContext): Promise<Response> => {
    return handleApiRequest(request, context, deps, async (request, context) => {
      const { stopId: rawStopId } = await context.params;
      const stopId = parsePathId(rawStopId, MAX_STOP_ID_LENGTH);
      if (!stopId.ok) return errorResponse("invalid_request", stopId.message);

      const date = parseServiceDateParam(new URL(request.url).searchParams.get("date"));
      if (!date.ok) return errorResponse("invalid_request", date.message);

      const result = await deps.getService().getStopTimetable(stopId.value, date.value);
      if (!result) return errorResponse("not_found", "Stop not found.");

      // Scheduled catalog data: safe to cache like the other catalog-backed endpoints.
      return jsonResponse(mapStopTimetableResult(result), { cacheControl: CATALOG_CACHE });
    });
  };
}
