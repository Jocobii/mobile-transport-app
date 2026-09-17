import type { VehicleDetailResult } from "@transit/core";
import type { VehicleDetailResponse } from "@transit/contracts";
import { mapFeedStatus } from "./feed-status";
import { mapRoute } from "./route";
import { mapUpcomingStop } from "./upcoming-stop";
import { mapVehicle } from "./vehicle";

export function mapVehicleDetailResult(result: VehicleDetailResult): VehicleDetailResponse {
  return {
    vehicle: mapVehicle(result.vehicle, result.route),
    route: mapRoute(result.route),
    upcomingStops: result.upcomingStops.map(mapUpcomingStop),
    feeds: result.feeds.map(mapFeedStatus),
  };
}
