import type { RouteDetailResponse } from "@transit/contracts";
import type { RouteDetailResult } from "@transit/core";
import { mapRoute } from "./route";
import { mapStop } from "./stop";

export function mapRouteDetailResult(result: RouteDetailResult): RouteDetailResponse {
  return {
    route: mapRoute(result.route),
    directions: result.directions,
    selectedDirectionId: result.selectedDirectionId,
    stops: result.stops.map(mapStop),
    shape: result.shape,
  };
}
