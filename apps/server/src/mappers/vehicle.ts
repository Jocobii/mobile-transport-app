import type { VehicleDto } from "@transit/contracts";
import type { Route, Vehicle } from "@transit/core";
import { normalizeHexColor } from "./color";
import { routeShortName } from "./route";

/** Maps a domain `Vehicle` to its DTO. `route` is the vehicle's own route (by `routeId`). */
export function mapVehicle(vehicle: Vehicle, route: Route): VehicleDto {
  return {
    id: vehicle.id,
    label: vehicle.label,
    routeId: vehicle.routeId,
    routeShortName: routeShortName(route),
    routeColor: normalizeHexColor(route.color),
    routeTextColor: normalizeHexColor(route.textColor),
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
