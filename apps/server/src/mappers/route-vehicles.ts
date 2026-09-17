import type { RouteVehiclesResponse } from "@transit/contracts";
import type { RouteVehiclesResult } from "@transit/core";
import { mapFeedStatus } from "./feed-status";
import { mapVehicle } from "./vehicle";

export function mapRouteVehiclesResult(result: RouteVehiclesResult): RouteVehiclesResponse {
  return {
    routeId: result.routeId,
    vehicles: result.vehicles.map((vehicle) => mapVehicle(vehicle, result.route)),
    feeds: result.feeds.map(mapFeedStatus),
  };
}
