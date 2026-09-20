import type { Position } from "./position";

/** Storage key for the last known user position. */
export const LAST_POSITION_STORAGE_KEY = "last-position";

function isCoordinate(value: unknown, limit: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= limit;
}

/** Parses a stored position; missing, malformed or out-of-range data gives `undefined`. */
export function parseStoredPosition(raw: string | null): Position | undefined {
  if (raw === null) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null) return undefined;
  const record = parsed as Record<string, unknown>;
  if (!isCoordinate(record.lat, 90) || !isCoordinate(record.lon, 180)) return undefined;
  return { lat: record.lat, lon: record.lon };
}
