import type { VehicleDto } from "@transit/contracts";
import type { Route, Vehicle } from "@transit/core";
import { routeShortName } from "./route";

/**
 * Maps a domain `Vehicle` to its DTO. `route` is the vehicle's own route (by `routeId`).
 * `headsign` is always "": the domain `Vehicle` model carries no headsign (10.7
 * normalization takes only routeId/directionId from the catalog trip), so there is no
 * source for it here, matching the empty-headsign gap already accepted for unmatched
 * predictions in `mergeArrivals` (10.9 rule 6).
 */
export function mapVehicle(vehicle: Vehicle, route: Route): VehicleDto {
  return {
    id: vehicle.id,
    label: vehicle.label,
    routeId: vehicle.routeId,
    routeShortName: routeShortName(route),
    directionId: vehicle.directionId,
    headsign: "",
    tripId: vehicle.tripId,
    bearing: vehicle.bearing,
    updatedAt: vehicle.updatedAt,
    occupancy: vehicle.occupancy,
    lat: vehicle.lat,
    lon: vehicle.lon,
  };
}
