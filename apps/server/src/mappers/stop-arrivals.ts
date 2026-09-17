import type { StopArrivalsResponse } from "@transit/contracts";
import type { StopArrivalsResult } from "@transit/core";
import { mapArrival } from "./arrival";
import { mapFeedStatus } from "./feed-status";
import { mapRoute } from "./route";
import { requireRoute, routesById } from "./route-lookup";
import { mapStop } from "./stop";

export function mapStopArrivalsResult(result: StopArrivalsResult): StopArrivalsResponse {
  const routeLookup = routesById(result.routes);
  return {
    stop: mapStop(result.stop),
    routes: result.routes.map(mapRoute),
    arrivals: result.arrivals.map((arrival) =>
      mapArrival(arrival, requireRoute(routeLookup, arrival.routeId)),
    ),
    feeds: result.feeds.map(mapFeedStatus),
  };
}
