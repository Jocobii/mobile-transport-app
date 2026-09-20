/** Pure timetable helpers (no React Native import, so Vitest can load them). */

/** A departure clock in the device time zone: `text` is `h:mm` (12-hour), no period. */
export interface ClockTime {
  text: string;
  period: "am" | "pm";
}

/** `6:23` + `am`, in the device time zone (like the arrival clocks). */
export function formatClockTime(time: number): ClockTime {
  const date = new Date(time * 1000);
  const hour = date.getHours();
  return {
    text: `${hour % 12 || 12}:${String(date.getMinutes()).padStart(2, "0")}`,
    period: hour < 12 ? "am" : "pm",
  };
}

export type DayPart = "earlyMorning" | "morning" | "afternoon" | "night" | "afterMidnight";

export interface DayPartSection {
  part: DayPart;
  /** Ascending epoch seconds. */
  times: number[];
}

/** Local hour boundaries: early morning < 5 ≤ morning < 12 ≤ afternoon < 19 ≤ night. */
function dayPartOfHour(hour: number): Exclude<DayPart, "afterMidnight"> {
  if (hour < 5) return "earlyMorning";
  if (hour < 12) return "morning";
  if (hour < 19) return "afternoon";
  return "night";
}

function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/**
 * Splits one service day's ascending departures into consecutive day-part sections (device time
 * zone). Departures on a later local calendar date than the first one (GTFS times past 24:00) go
 * to "afterMidnight", so they are never mixed with the morning of the same service day.
 */
export function groupTimesByDayPart(times: readonly number[]): DayPartSection[] {
  const sections: DayPartSection[] = [];
  const first = times[0];
  if (first === undefined) return sections;
  const firstDay = localDayKey(new Date(first * 1000));

  for (const time of times) {
    const date = new Date(time * 1000);
    const part = localDayKey(date) === firstDay ? dayPartOfHour(date.getHours()) : "afterMidnight";
    const last = sections[sections.length - 1];
    if (last && last.part === part) {
      last.times.push(time);
    } else {
      sections.push({ part, times: [time] });
    }
  }
  return sections;
}

/** Minimum departures before a typical headway is shown (fewer is not a pattern). */
const MIN_TIMES_FOR_HEADWAY = 4;

/**
 * Typical minutes between departures: the median gap, rounded to 5 min from 10 min up (to 1 min
 * below). `undefined` with fewer than 4 departures.
 */
export function typicalHeadwayMinutes(times: readonly number[]): number | undefined {
  if (times.length < MIN_TIMES_FOR_HEADWAY) return undefined;
  const gaps: number[] = [];
  for (let index = 1; index < times.length; index += 1) {
    const current = times[index];
    const previous = times[index - 1];
    if (current !== undefined && previous !== undefined) gaps.push((current - previous) / 60);
  }
  gaps.sort((a, b) => a - b);
  const middle = Math.floor(gaps.length / 2);
  const median =
    gaps.length % 2 === 0
      ? ((gaps[middle - 1] ?? 0) + (gaps[middle] ?? 0)) / 2
      : (gaps[middle] ?? 0);
  if (median < 10) return Math.max(1, Math.round(median));
  return Math.round(median / 5) * 5;
}

export interface CountdownLabel {
  key: "now" | "minutes" | "hours" | "hoursMinutes";
  params: { minutes?: number; hours?: number };
}

/** "ahora" under a minute, then minutes, then hours (+ minutes when not a whole hour). */
export function formatCountdown(seconds: number): CountdownLabel {
  const totalMinutes = Math.floor(seconds / 60);
  if (totalMinutes < 1) return { key: "now", params: {} };
  if (totalMinutes < 60) return { key: "minutes", params: { minutes: totalMinutes } };
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0
    ? { key: "hours", params: { hours } }
    : { key: "hoursMinutes", params: { hours, minutes } };
}

/** Departures before `now` and the rest (from the next one on). */
export function splitPassedTimes(
  times: readonly number[],
  now: number,
): { passed: number[]; upcoming: number[] } {
  const index = times.findIndex((time) => time >= now);
  if (index === -1) return { passed: [...times], upcoming: [] };
  return { passed: times.slice(0, index), upcoming: times.slice(index) };
}

/** The first departure at or after `now`, or `undefined` when all have passed. */
export function findNextDeparture(times: readonly number[], now: number): number | undefined {
  return times.find((time) => time >= now);
}

export interface ServiceDayLabels {
  today: string;
  tomorrow: string;
  /** Short weekday names, index 0 = Sunday. */
  weekdays: readonly string[];
}

function utcDate(serviceDate: string): Date {
  return new Date(
    Date.UTC(
      Number(serviceDate.slice(0, 4)),
      Number(serviceDate.slice(4, 6)) - 1,
      Number(serviceDate.slice(6, 8)),
    ),
  );
}

/** The `YYYYMMDD` after `serviceDate` (UTC math: no device time zone involved). */
function nextServiceDate(serviceDate: string): string {
  const next = utcDate(serviceDate);
  next.setUTCDate(next.getUTCDate() + 1);
  const month = String(next.getUTCMonth() + 1).padStart(2, "0");
  const day = String(next.getUTCDate()).padStart(2, "0");
  return `${next.getUTCFullYear()}${month}${day}`;
}

/** "Hoy", "Mañana", otherwise `{weekday} {day}` (e.g. "sáb 20"), from `YYYYMMDD` service dates. */
export function formatServiceDayLabel(
  serviceDate: string,
  today: string,
  labels: ServiceDayLabels,
): string {
  if (serviceDate === today) return labels.today;
  if (serviceDate === nextServiceDate(today)) return labels.tomorrow;
  const weekday = labels.weekdays[utcDate(serviceDate).getUTCDay()] ?? "";
  return `${weekday} ${Number(serviceDate.slice(6, 8))}`;
}

/**
 * The neighbouring day in `availableDates` (ascending). `undefined` at either end or when
 * `current` is not one of the dates.
 */
export function stepServiceDate(
  availableDates: readonly string[],
  current: string,
  direction: "next" | "previous",
): string | undefined {
  const index = availableDates.indexOf(current);
  if (index === -1) return undefined;
  return availableDates[direction === "next" ? index + 1 : index - 1];
}
