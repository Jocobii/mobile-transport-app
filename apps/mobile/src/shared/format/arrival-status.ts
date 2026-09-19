import type { ArrivalDto } from "@transit/contracts";
import type { ArrivalStatusTone } from "@/shared/theme";

export type ArrivalStatusInput = Pick<ArrivalDto, "source" | "status" | "delaySec">;

export type ArrivalStatusKey =
  | "arrival.canceled"
  | "arrival.skipped"
  | "arrival.scheduled"
  | "arrival.liveOnTime"
  | "arrival.liveLate"
  | "arrival.liveEarly";

export interface ArrivalStatusLabel {
  key: ArrivalStatusKey;
  params?: { minutes: number };
  status: ArrivalStatusTone;
}

const SECONDS_PER_MINUTE = 60;
/** On time when `-60 < delaySec < 120`: late from 2 min, early from 1 min before. */
const LATE_THRESHOLD_SEC = 120;
const EARLY_THRESHOLD_SEC = -60;

export function formatArrivalStatus(arrival: ArrivalStatusInput): ArrivalStatusLabel {
  if (arrival.status === "canceled") return { key: "arrival.canceled", status: "problem" };
  if (arrival.status === "skipped") return { key: "arrival.skipped", status: "problem" };
  if (arrival.source === "scheduled") return { key: "arrival.scheduled", status: "neutral" };

  const delaySec = arrival.delaySec;
  if (delaySec === undefined) return { key: "arrival.liveOnTime", status: "ok" };
  if (delaySec >= LATE_THRESHOLD_SEC) {
    return {
      key: "arrival.liveLate",
      params: { minutes: Math.round(delaySec / SECONDS_PER_MINUTE) },
      status: "attention",
    };
  }
  if (delaySec <= EARLY_THRESHOLD_SEC) {
    return {
      key: "arrival.liveEarly",
      params: { minutes: Math.max(1, Math.round(-delaySec / SECONDS_PER_MINUTE)) },
      status: "attention",
    };
  }
  return { key: "arrival.liveOnTime", status: "ok" };
}
