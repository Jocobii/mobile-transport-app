import type { VehiclesInAreaResponse } from "@transit/contracts";
import type { VehiclesInAreaResult } from "@transit/core";
import { mapFeedStatus } from "./feed-status";
import { mapVehicle } from "./vehicle";

export function mapVehiclesInAreaResult(result: VehiclesInAreaResult): VehiclesInAreaResponse {
  return {
    vehicles: result.vehicles.map(({ vehicle, route }) => mapVehicle(vehicle, route)),
    truncated: result.truncated,
    feeds: result.feeds.map(mapFeedStatus),
  };
}
