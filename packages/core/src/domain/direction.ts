import type { DirectionId, LatLon, RoutePattern } from "../model";
import { haversineMeters } from "./geo";

export type SelectRoutePatternResult =
  | { ok: true; pattern: RoutePattern }
  | { ok: false; reason: "not_found" | "invalid_direction" };

/**
 * Direction selection for route detail (10.12). `patterns` are every pattern already
 * loaded for the route (0, 1 or 2 directions); no patterns means the route itself is
 * treated as not found.
 */
export function selectRoutePattern(
  patterns: RoutePattern[],
  options: { directionId?: DirectionId; near?: LatLon },
): SelectRoutePatternResult {
  if (patterns.length === 0) return { ok: false, reason: "not_found" };

  if (options.directionId !== undefined) {
    const pattern = patterns.find((p) => p.directionId === options.directionId);
    return pattern ? { ok: true, pattern } : { ok: false, reason: "invalid_direction" };
  }

  if (options.near) {
    const near = options.near;
    let best = patterns[0] as RoutePattern;
    let bestDistance = closestStopDistance(best, near);
    for (const pattern of patterns.slice(1)) {
      const distance = closestStopDistance(pattern, near);
      if (
        distance < bestDistance ||
        (distance === bestDistance && pattern.directionId < best.directionId)
      ) {
        best = pattern;
        bestDistance = distance;
      }
    }
    return { ok: true, pattern: best };
  }

  const lowest = [...patterns].sort((a, b) => a.directionId - b.directionId)[0] as RoutePattern;
  return { ok: true, pattern: lowest };
}

function closestStopDistance(pattern: RoutePattern, near: LatLon): number {
  let min = Number.POSITIVE_INFINITY;
  for (const stop of pattern.stops) {
    const distance = haversineMeters(near, stop);
    if (distance < min) min = distance;
  }
  return min;
}
