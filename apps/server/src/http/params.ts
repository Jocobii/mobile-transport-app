import { isValidNormalizedQuery, normalizeQuery } from "@transit/core";
import type { DirectionId, LatLon, TransitSettings } from "@transit/core";

export type ParseResult<T> = { ok: true; value: T } | { ok: false; message: string };

function ok<T>(value: T): ParseResult<T> {
  return { ok: true, value };
}

function fail<T>(message: string): ParseResult<T> {
  return { ok: false, message };
}

function parseFiniteNumber(raw: string | null): number | undefined {
  if (raw === null || raw.trim() === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

/** Required `lat`/`lon` query parameters (`stops/nearby`). */
export function parseLatLon(params: URLSearchParams): ParseResult<LatLon> {
  const lat = parseFiniteNumber(params.get("lat"));
  const lon = parseFiniteNumber(params.get("lon"));
  if (lat === undefined || lon === undefined) {
    return fail("`lat` and `lon` are required and must be numbers.");
  }
  if (lat < -90 || lat > 90) return fail("`lat` must be between -90 and 90.");
  if (lon < -180 || lon > 180) return fail("`lon` must be between -180 and 180.");
  return ok({ lat, lon });
}

/** Optional `lat`/`lon` pair: both present, both absent, or an error (`routes/{routeId}`). */
export function parseOptionalLatLon(params: URLSearchParams): ParseResult<LatLon | undefined> {
  const hasLat = params.get("lat") !== null;
  const hasLon = params.get("lon") !== null;
  if (!hasLat && !hasLon) return ok(undefined);
  if (hasLat !== hasLon) return fail("`lat` and `lon` must be given together.");
  return parseLatLon(params);
}

/** Optional `radius` query parameter (integer meters within the configured bounds). */
type RadiusSettings = Pick<
  TransitSettings,
  "nearbyDefaultRadiusMeters" | "nearbyMinRadiusMeters" | "nearbyMaxRadiusMeters"
>;

export function parseRadius(
  params: URLSearchParams,
  settings: RadiusSettings,
): ParseResult<number> {
  const raw = params.get("radius");
  if (raw === null || raw.trim() === "") return ok(settings.nearbyDefaultRadiusMeters);

  const value = Number(raw);
  if (!Number.isInteger(value)) return fail("`radius` must be an integer.");
  const { nearbyMinRadiusMeters: min, nearbyMaxRadiusMeters: max } = settings;
  if (value < min || value > max) {
    return fail(`\`radius\` must be between ${min} and ${max}.`);
  }
  return ok(value);
}

/** Optional `directionId` query parameter, must be `"0"` or `"1"` when present. */
export function parseDirectionId(params: URLSearchParams): ParseResult<DirectionId | undefined> {
  const raw = params.get("directionId");
  if (raw === null || raw.trim() === "") return ok(undefined);
  if (raw === "0") return ok(0);
  if (raw === "1") return ok(1);
  return fail('`directionId` must be "0" or "1".');
}

/** Required `q` search query parameter. */
export function parseSearchQuery(
  params: URLSearchParams,
  settings: Pick<TransitSettings, "searchMaxQueryLength">,
): ParseResult<string> {
  const raw = params.get("q");
  if (raw === null) return fail("`q` is required.");
  if (raw.length > settings.searchMaxQueryLength) {
    return fail(`\`q\` must be at most ${settings.searchMaxQueryLength} characters.`);
  }
  if (!isValidNormalizedQuery(normalizeQuery(raw))) {
    return fail("`q` must not be empty.");
  }
  return ok(raw);
}

/**
 * A required path segment (e.g. `stopId`, `vehicleId`), non-empty and within `maxLength`.
 * Next.js dynamic route params are already URL-decoded, so `value` is used as given.
 */
export function parsePathId(value: string, maxLength: number): ParseResult<string> {
  if (value.length === 0) return fail("Path parameter must not be empty.");
  if (value.length > maxLength) {
    return fail(`Path parameter must be at most ${maxLength} characters.`);
  }
  return ok(value);
}
