import type { NearbyResult } from "@transit/core";
import type { NearbyStopsResponse } from "@transit/contracts";
import { mapArrival } from "./arrival";
import { mapFeedStatus } from "./feed-status";
import { requireRoute, routesById } from "./route-lookup";
import { mapRoute } from "./route";
import { mapStop } from "./stop";
import { mapVehicle } from "./vehicle";

export function mapNearbyResult(result: NearbyResult): NearbyStopsResponse {
  return {
    stops: result.stops.map((nearbyStop) => {
      const routeLookup = routesById(nearbyStop.routes);
      return {
        stop: mapStop(nearbyStop.stop),
        distanceMeters: nearbyStop.distanceMeters,
        routes: nearbyStop.routes.map(mapRoute),
        nextArrivals: nearbyStop.nextArrivals.map((arrival) =>
          mapArrival(arrival, requireRoute(routeLookup, arrival.routeId)),
        ),
        approachingVehicles: nearbyStop.approachingVehicles.map((vehicle) =>
          mapVehicle(vehicle, requireRoute(routeLookup, vehicle.routeId)),
        ),
      };
    }),
    outsideRadius: result.outsideRadius,
    feeds: result.feeds.map(mapFeedStatus),
  };
}
