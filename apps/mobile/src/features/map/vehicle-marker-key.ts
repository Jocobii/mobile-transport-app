import type { VehicleDto } from "@transit/contracts";

/**
 * Key that changes whenever the marker's pill changes (vehicle, route, colors, mode). The bearing is not
 * part of it: the arrow is a separate marker rotated natively, so a turn never rebuilds the pill.
 */
export function vehicleMarkerKey(vehicle: VehicleDto): string {
  return [
    vehicle.id,
    vehicle.routeShortName,
    vehicle.routeColor ?? "none",
    vehicle.routeTextColor ?? "none",
    vehicle.mode ?? "none",
  ].join(":");
}

/**
 * True when nothing the marker draws changed. Every poll returns new `VehicleDto` objects, so
 * reference equality would re-render all markers each time; this compares what they show.
 */
export function sameVehicleMarker(a: VehicleDto, b: VehicleDto): boolean {
  return (
    a.id === b.id &&
    a.lat === b.lat &&
    a.lon === b.lon &&
    a.bearing === b.bearing &&
    a.routeShortName === b.routeShortName &&
    a.routeColor === b.routeColor &&
    a.routeTextColor === b.routeTextColor &&
    a.mode === b.mode &&
    a.headsign === b.headsign
  );
}
