import type { NearbyStopDto, VehicleDto } from "@transit/contracts";

/** Approaching vehicles across all stops, one per vehicle id (a bus can approach several stops). */
export function collectApproachingVehicles(stops: NearbyStopDto[]): VehicleDto[] {
  const byId = new Map<string, VehicleDto>();
  for (const { approachingVehicles } of stops) {
    for (const vehicle of approachingVehicles) {
      if (!byId.has(vehicle.id)) byId.set(vehicle.id, vehicle);
    }
  }
  return [...byId.values()];
}
