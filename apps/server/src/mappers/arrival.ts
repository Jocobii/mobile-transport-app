import type { Arrival, Route } from "@transit/core";
import type { ArrivalDto } from "@transit/contracts";
import { routeShortName } from "./route";

/** Maps a domain `Arrival` to its DTO. `route` is the arrival's own route (by `routeId`). */
export function mapArrival(arrival: Arrival, route: Route): ArrivalDto {
  return {
    tripId: arrival.tripId,
    routeId: arrival.routeId,
    routeShortName: routeShortName(route),
    routeColor: route.color,
    directionId: arrival.directionId,
    headsign: arrival.headsign,
    time: arrival.time,
    scheduledTime: arrival.scheduledTime,
    delaySec: arrival.delaySec,
    source: arrival.source,
    status: arrival.status,
    vehicleId: arrival.vehicleId,
  };
}
