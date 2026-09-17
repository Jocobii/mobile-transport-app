const NATURAL_COLLATOR = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

/**
 * Compares two strings the way a person reads route numbers: digit runs compare
 * numerically ("9" before "54"), everything else compares alphabetically.
 */
export function compareNaturally(a: string, b: string): number {
  return NATURAL_COLLATOR.compare(a, b);
}

/**
 * Compares two route identifiers naturally. Route ids are `${feedId}:${route_id}`, and for
 * both agencies in this app `route_id` already tracks the route's rider-facing number, so
 * this needs no catalog lookup and stays usable from pure domain code (e.g. `mergeArrivals`).
 */
export function compareRoutesNaturally(routeIdA: string, routeIdB: string): number {
  return compareNaturally(routeIdA, routeIdB);
}
