import type { Bounds } from "@transit/core";
import type { ParseResult } from "./params";

function ok<T>(value: T): ParseResult<T> {
  return { ok: true, value };
}

function fail<T>(message: string): ParseResult<T> {
  return { ok: false, message };
}

/**
 * Required `bbox` query parameter: `minLon,minLat,maxLon,maxLat` (GeoJSON order, decimal
 * degrees). Validated against `maxSpanDegrees` per axis (a different limit for stops and
 * vehicles). Returns core `Bounds` (`minLat`/`minLon`/`maxLat`/`maxLon`).
 */
export function parseBbox(params: URLSearchParams, maxSpanDegrees: number): ParseResult<Bounds> {
  const raw = params.get("bbox");
  if (raw === null || raw.trim() === "") return fail("`bbox` is required.");

  const parts = raw.split(",");
  if (parts.length !== 4) {
    return fail("`bbox` must have 4 comma-separated values: minLon,minLat,maxLon,maxLat.");
  }

  const [minLonRaw, minLatRaw, maxLonRaw, maxLatRaw] = parts;
  const minLon = Number(minLonRaw);
  const minLat = Number(minLatRaw);
  const maxLon = Number(maxLonRaw);
  const maxLat = Number(maxLatRaw);
  if (![minLon, minLat, maxLon, maxLat].every(Number.isFinite)) {
    return fail("`bbox` values must be finite numbers.");
  }

  if (minLat < -90 || maxLat > 90) return fail("`bbox` latitudes must be between -90 and 90.");
  if (minLon < -180 || maxLon > 180) return fail("`bbox` longitudes must be between -180 and 180.");
  if (minLat >= maxLat || minLon >= maxLon) {
    return fail("`bbox` min values must be less than the max values.");
  }

  // Bounds this close to the limit are floating-point noise, not a real over-large request
  // (the app itself computes bboxes via subtraction/addition on degrees before sending them).
  const SPAN_EPSILON_DEGREES = 1e-9;
  const latSpan = maxLat - minLat;
  const lonSpan = maxLon - minLon;
  if (
    latSpan > maxSpanDegrees + SPAN_EPSILON_DEGREES ||
    lonSpan > maxSpanDegrees + SPAN_EPSILON_DEGREES
  ) {
    return fail(`\`bbox\` span must be at most ${maxSpanDegrees} degrees per axis.`);
  }

  return ok({ minLat, minLon, maxLat, maxLon });
}
