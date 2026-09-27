import {
  MAP_ROUTE_NAME_MAX_CHARS,
  VEHICLE_LABEL_FULL_MAX_DELTA,
  VEHICLE_LABEL_NUMBER_MAX_DELTA,
} from "./map-config";

/** How much a bus label shows at the current zoom (see `VEHICLE_LABEL_*_MAX_DELTA`). */
export type VehicleLabelDetail = "none" | "number" | "full";

/** Detail for the map's `latitudeDelta`; before the map reports a region, the number only. */
export function vehicleLabelDetail(latitudeDelta: number | undefined): VehicleLabelDetail {
  if (latitudeDelta === undefined) return "number";
  if (latitudeDelta <= VEHICLE_LABEL_FULL_MAX_DELTA) return "full";
  if (latitudeDelta <= VEHICLE_LABEL_NUMBER_MAX_DELTA) return "number";
  return "none";
}

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
