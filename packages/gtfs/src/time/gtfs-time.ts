import { addDays, localServiceDate } from "@transit/core";
import type { EpochSeconds, ServiceDate } from "@transit/core";

export { addDays, localServiceDate };

/** Where a value was read from, for error messages. */
export interface GtfsParseLocation {
  file: string;
  row: number;
}

export class GtfsParseError extends Error {
  readonly file?: string;
  readonly row?: number;

  constructor(message: string, location?: GtfsParseLocation) {
    const suffix = location ? ` (${location.file}:${location.row})` : "";
    super(`${message}${suffix}`);
    this.name = "GtfsParseError";
    this.file = location?.file;
    this.row = location?.row;
  }
}

const GTFS_TIME_PATTERN = /^(\d{1,3}):([0-5]\d):([0-5]\d)$/;

/**
 * Parses a GTFS `HH:MM:SS` time (hours may be ≥ 24 for trips past midnight)
 * into seconds after midnight of the service date.
 */
export function parseGtfsTime(value: string, location?: GtfsParseLocation): number {
  const match = GTFS_TIME_PATTERN.exec(value.trim());
  if (!match) {
    throw new GtfsParseError(`Invalid GTFS time "${value}"`, location);
  }
  const [, hours, minutes, seconds] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

/** The timezone's UTC offset in seconds at the given instant (local = UTC + offset). */
function offsetSecondsAt(epochSeconds: EpochSeconds, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(epochSeconds * 1000));

  const get = (type: string): number => Number(parts.find((part) => part.type === type)?.value);
  const asUtc =
    Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) /
    1000;
  return asUtc - epochSeconds;
}

/**
 * Converts a local wall-clock date/time in `timezone` to epoch seconds.
 * Computes the zone offset at a first-guess instant, applies it, then
 * re-checks the offset once more (it can change across a DST transition).
 */
function zonedEpoch(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timezone: string,
): EpochSeconds {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second) / 1000;
  const firstOffset = offsetSecondsAt(guess, timezone);
  const adjusted = guess - firstOffset;
  const secondOffset = offsetSecondsAt(adjusted, timezone);
  return secondOffset === firstOffset ? adjusted : guess - secondOffset;
}

/**
 * GTFS local time → epoch seconds.
 * `epochFor = zonedEpoch(serviceDate at 12:00:00 local) - 12h + secondsAfterMidnight`.
 * Anchoring on local noon (never ambiguous or skipped by DST) avoids having to
 * resolve the actual, possibly ≥ 24:00:00, wall-clock time against DST rules.
 */
export function epochFor(
  serviceDate: ServiceDate,
  secondsAfterMidnight: number,
  timezone: string,
): EpochSeconds {
  const year = Number(serviceDate.slice(0, 4));
  const month = Number(serviceDate.slice(4, 6));
  const day = Number(serviceDate.slice(6, 8));
  const localNoon = zonedEpoch(year, month, day, 12, 0, 0, timezone);
  return localNoon - 12 * 3600 + secondsAfterMidnight;
}
