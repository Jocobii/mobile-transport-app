import type { ArrivalDto } from "@transit/contracts";

export type ArrivalTimeInput = Pick<ArrivalDto, "time" | "scheduledTime" | "status">;

/** Translated words the formatter needs; the caller supplies them from i18n. */
export interface ArrivalTimeLabels {
  now: string;
  minutesUnit: string;
}

export interface ArrivalTimeText {
  primary: string;
  unit: string;
  struck: boolean;
}

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

/** `h:mm` in the device's local time zone, 12-hour, without an a.m./p.m. suffix. */
function clockTime(epochSeconds: number): string {
  const date = new Date(epochSeconds * 1000);
  const hours = date.getHours() % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function formatArrivalTime(
  arrival: ArrivalTimeInput,
  now: number,
  labels: ArrivalTimeLabels,
): ArrivalTimeText {
  if (arrival.status !== "normal") {
    return { primary: clockTime(arrival.scheduledTime ?? arrival.time), unit: "", struck: true };
  }

  const diff = arrival.time - now;
  if (diff < SECONDS_PER_MINUTE) return { primary: labels.now, unit: "", struck: false };
  if (diff < SECONDS_PER_HOUR) {
    return {
      primary: String(Math.floor(diff / SECONDS_PER_MINUTE)),
      unit: labels.minutesUnit,
      struck: false,
    };
  }
  return { primary: clockTime(arrival.time), unit: "", struck: false };
}
