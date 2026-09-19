import type { NearbyStopDto } from "@transit/contracts";

function approaches(stop: NearbyStopDto, vehicleId: string): boolean {
  return stop.approachingVehicles.some((vehicle) => vehicle.id === vehicleId);
}

/**
 * Stop context for opening a bus (§3 "Opening a bus"): "my stop" if the bus approaches it;
 * otherwise no stop. A stop is never picked automatically: only the one the user set counts.
 * Opening a bus never sets "my stop" itself.
 */
export function resolveVehicleStop(
  vehicleId: string,
  nearbyStops: NearbyStopDto[] | undefined,
  highlightedStopId: string | undefined,
): string | undefined {
  if (highlightedStopId === undefined) return undefined;
  const myStop = nearbyStops?.find((stop) => stop.stop.id === highlightedStopId);
  return myStop && approaches(myStop, vehicleId) ? highlightedStopId : undefined;
}
