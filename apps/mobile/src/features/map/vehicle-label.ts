import { MAP_ROUTE_NAME_MAX_CHARS } from "./map-config";

/** How much a vehicle label shows (decided by `placeVehicleLabels`). */
export type VehicleLabelDetail = "none" | "number" | "full";

/**
 * Route name as drawn on a map label: routes without a GTFS short name fall back to their long
 * name ("METRO B Line"), so anything longer than `MAP_ROUTE_NAME_MAX_CHARS` is cut with "…".
 */
export function mapRouteName(name: string): string {
  const chars = [...name.trim()];
  if (chars.length <= MAP_ROUTE_NAME_MAX_CHARS) return chars.join("");
  return `${chars
    .slice(0, MAP_ROUTE_NAME_MAX_CHARS - 1)
    .join("")
    .trimEnd()}…`;
}
