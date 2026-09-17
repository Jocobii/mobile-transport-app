import type { EpochSeconds, ServiceDate } from "../model";

function parseServiceDate(serviceDate: ServiceDate): { year: number; month: number; day: number } {
  return {
    year: Number(serviceDate.slice(0, 4)),
    month: Number(serviceDate.slice(4, 6)),
    day: Number(serviceDate.slice(6, 8)),
  };
}

/** The local calendar date (`YYYYMMDD`) of an epoch in `timezone`. */
export function localServiceDate(epoch: EpochSeconds, timezone: string): ServiceDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(epoch * 1000));
  const get = (type: string): string => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}${get("month")}${get("day")}`;
}

/** Adds (or subtracts) whole calendar days to a `YYYYMMDD` service date. */
export function addDays(serviceDate: ServiceDate, days: number): ServiceDate {
  const { year, month, day } = parseServiceDate(serviceDate);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  const yyyy = String(shifted.getUTCFullYear()).padStart(4, "0");
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(shifted.getUTCDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}
