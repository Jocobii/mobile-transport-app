import type { VehicleDto } from "@transit/contracts";
import { BEARING_STEP_DEGREES } from "./map-config";

/** Bearing rounded to the marker step, or undefined when the vehicle reports none. */
export function markerBearing(vehicle: VehicleDto): number | undefined {
  if (vehicle.bearing === undefined) return undefined;
  return Math.round(vehicle.bearing / BEARING_STEP_DEGREES) * BEARING_STEP_DEGREES;
}

/** Key that changes whenever the marker's look changes (route, colors, rounded bearing). */
export function vehicleMarkerKey(vehicle: VehicleDto): string {
  return [
    vehicle.id,
    vehicle.routeShortName,
    vehicle.routeColor ?? "none",
    vehicle.routeTextColor ?? "none",
    markerBearing(vehicle) ?? "none",
  ].join(":");
}
