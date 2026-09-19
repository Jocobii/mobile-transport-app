import type { StopSummaryDto, UpcomingStopDto, VehicleDto } from "@transit/contracts";
import type { VehicleMapContent } from "./use-vehicle-view";

/**
 * Map content for the Vehicle view (E005-T09): every upcoming stop, deduped by id (a route can
 * revisit a stop), plus the bus. The vehicle-view stop (if any) is marked selected separately.
 */
export function buildVehicleMapContent(
  vehicle: VehicleDto | undefined,
  upcomingStops: UpcomingStopDto[],
): VehicleMapContent {
  const seen = new Set<string>();
  const stops: StopSummaryDto[] = [];
  for (const upcoming of upcomingStops) {
    if (seen.has(upcoming.stop.id)) continue;
    seen.add(upcoming.stop.id);
    stops.push(upcoming.stop);
  }
  return { stops, vehicles: vehicle ? [vehicle] : [] };
}
