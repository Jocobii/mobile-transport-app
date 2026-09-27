import type { TransitMode } from "@transit/core";

/**
 * Maps a GTFS route to the canonical `TransitMode`.
 *
 * - `route_type` decides rail vs bus. Both the basic values (0–12) and the extended
 *   "Hierarchical Vehicle Type" values (100–1700) are accepted, since agencies publish either.
 * - GTFS has no bus rapid transit type (BRT routes are plain `3`), so a bus becomes `brt` only when
 *   the feed config names the agency's BRT prefix (`brtLongNamePrefix`). Rail keeps its mode.
 * - Anything else (missing, unknown, ferry, aerial…) falls back to `bus`: the most common mode, and
 *   the one the map already draws by default. Add a mode here when a configured feed needs it.
 */
export function transitMode(
  routeType: string | undefined,
  longName: string,
  brtLongNamePrefix: string | undefined,
): TransitMode {
  const railMode = railModeOf(Number.parseInt(routeType ?? "", 10));
  if (railMode) return railMode;
  if (brtLongNamePrefix && longName.startsWith(brtLongNamePrefix)) return "brt";
  return "bus";
}

function railModeOf(type: number): TransitMode | undefined {
  // Basic: 0 tram/light rail, 5 cable tram. Extended: 900–906 tram service.
  if (type === 0 || type === 5 || (type >= 900 && type <= 906)) return "lightRail";
  // Basic: 1 subway, 2 rail, 12 monorail. Extended: 100–117 railway, 400–405 urban railway.
  if (type === 1 || type === 2 || type === 12) return "rail";
  if ((type >= 100 && type <= 117) || (type >= 400 && type <= 405)) return "rail";
  return undefined;
}
