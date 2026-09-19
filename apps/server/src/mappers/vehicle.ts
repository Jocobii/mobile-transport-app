import type { VehicleDto } from "@transit/contracts";
import type { Route, Vehicle } from "@transit/core";
import { routeShortName } from "./route";

/** Maps a domain `Vehicle` to its DTO. `route` is the vehicle's own route (by `routeId`). */
export function mapVehicle(vehicle: Vehicle, route: Route): VehicleDto {
  return {
    id: vehicle.id,
    label: vehicle.label,
    routeId: vehicle.routeId,
    routeShortName: routeShortName(route),
    directionId: vehicle.directionId,
    headsign: vehicle.headsign,
    tripId: vehicle.tripId,
    bearing: vehicle.bearing,
    updatedAt: vehicle.updatedAt,
    occupancy: vehicle.occupancy,
    lat: vehicle.lat,
    lon: vehicle.lon,
  };
}
