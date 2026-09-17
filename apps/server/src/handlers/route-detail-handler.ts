import type { TransitService } from "@transit/core";
import { InvalidDirectionError } from "@transit/core";
import type { ServerConfigResult } from "@/config/server-config";
import { handleApiRequest } from "@/http/handle-api-request";
import { parseDirectionId, parseOptionalLatLon } from "@/http/params";
import { CATALOG_CACHE, errorResponse, jsonResponse } from "@/http/responses";
import { mapRouteDetailResult } from "@/mappers/route-detail";

export interface RouteDetailHandlerDeps {
  getService: () => TransitService;
  readConfig: () => ServerConfigResult;
}

export interface RouteDetailRouteContext {
  params: Promise<{ routeId: string }>;
}

export function createRouteDetailHandler(deps: RouteDetailHandlerDeps) {
  return async (request: Request, context: RouteDetailRouteContext): Promise<Response> => {
    return handleApiRequest(request, context, deps, async (request, context) => {
      const { routeId } = await context.params;
      const params = new URL(request.url).searchParams;

      const directionId = parseDirectionId(params);
      if (!directionId.ok) return errorResponse("invalid_request", directionId.message);

      const near = parseOptionalLatLon(params);
      if (!near.ok) return errorResponse("invalid_request", near.message);

      let result: Awaited<ReturnType<TransitService["getRouteDetail"]>>;
      try {
        result = await deps
          .getService()
          .getRouteDetail(routeId, { directionId: directionId.value, near: near.value });
      } catch (err) {
        if (err instanceof InvalidDirectionError) {
          return errorResponse("invalid_request", err.message);
        }
        throw err;
      }

      if (!result) return errorResponse("not_found", "Route not found.");
      return jsonResponse(mapRouteDetailResult(result), { cacheControl: CATALOG_CACHE });
    });
  };
}
