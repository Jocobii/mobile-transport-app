/** Which message an empty Nearby list shows (a translation key under `nearby.`). */
export type NearbyEmptyKey = "empty" | "emptyRoutes" | "emptyFiltered";

/**
 * With the route filter on, an empty list always points at the filter (the user cannot see it
 * on screen); otherwise no stops at all and stops without departures have their own messages.
 */
export function nearbyEmptyKey(stopCount: number, routeFilterActive: boolean): NearbyEmptyKey {
  if (routeFilterActive) return "emptyFiltered";
  return stopCount === 0 ? "empty" : "emptyRoutes";
}
