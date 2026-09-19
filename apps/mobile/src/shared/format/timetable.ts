/** Pure timetable helpers (no React Native import, so Vitest can load them). */

export interface HourRowMinute {
  /** Epoch seconds of the departure. */
  time: number;
  /** Two-digit minutes, e.g. `05`. */
  text: string;
}

export interface HourRow {
  /** Unique per local date + hour; safe as a list key. */
  key: string;
  /** 1-12. */
  hour12: number;
  period: "am" | "pm";
  minutes: HourRowMinute[];
}

/**
 * Groups ascending departures into one row per local hour (device time zone, like the arrival
 * clocks). A new row starts when the local calendar date or hour changes, so after-midnight
 * departures of the same service day land in later rows ("12 a. m.", "1 a. m.") after the evening.
 */
export function groupTimesByHour(times: readonly number[]): HourRow[] {
  const rows: HourRow[] = [];
  for (const time of times) {
    const date = new Date(time * 1000);
    const hour = date.getHours();
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${hour}`;
    const minute = { time, text: String(date.getMinutes()).padStart(2, "0") };

    const last = rows[rows.length - 1];
    if (last && last.key === key) {
      last.minutes.push(minute);
    } else {
      rows.push({
        key,
        hour12: hour % 12 || 12,
        period: hour < 12 ? "am" : "pm",
        minutes: [minute],
      });
    }
  }
  return rows;
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
