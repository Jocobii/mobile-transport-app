import type { DirectionId, LatLon, TransitSettings } from "@transit/core";
import { isValidNormalizedQuery, normalizeQuery } from "@transit/core";

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

/**
 * Optional `radius` query parameter (integer meters within the configured bounds).
 * `undefined` when the client omits it, so the caller can run the adaptive radius search.
 */
type RadiusSettings = Pick<TransitSettings, "nearbyMinRadiusMeters" | "nearbyMaxRadiusMeters">;

export function parseRadius(
  params: URLSearchParams,
  settings: RadiusSettings,
): ParseResult<number | undefined> {
  const raw = params.get("radius");
  if (raw === null || raw.trim() === "") return ok(undefined);

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

/**
 * Optional `date` query parameter: a real calendar date as `YYYYMMDD` (a GTFS service date).
 * `undefined` when absent so the service can default to today in the stop's time zone.
 */
export function parseServiceDateParam(raw: string | null): ParseResult<string | undefined> {
  if (raw === null || raw === "") return ok(undefined);
  if (!/^\d{8}$/.test(raw)) return fail("`date` must be a date formatted as YYYYMMDD.");

  const year = Number(raw.slice(0, 4));
  const month = Number(raw.slice(4, 6));
  const day = Number(raw.slice(6, 8));
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const isRealDate =
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;
  if (!isRealDate) return fail("`date` must be a real calendar date.");
  return ok(raw);
}
