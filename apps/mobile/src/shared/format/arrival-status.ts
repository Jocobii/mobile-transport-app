import type { ArrivalDto } from "@transit/contracts";

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
  tone: "live" | "scheduled" | "problem";
}

const SECONDS_PER_MINUTE = 60;

export function formatArrivalStatus(arrival: ArrivalStatusInput): ArrivalStatusLabel {
  if (arrival.status === "canceled") return { key: "arrival.canceled", tone: "problem" };
  if (arrival.status === "skipped") return { key: "arrival.skipped", tone: "problem" };
  if (arrival.source === "scheduled") return { key: "arrival.scheduled", tone: "scheduled" };

  const delaySec = arrival.delaySec ?? 0;
  if (delaySec >= SECONDS_PER_MINUTE) {
    return {
      key: "arrival.liveLate",
      params: { minutes: Math.round(delaySec / SECONDS_PER_MINUTE) },
      tone: "live",
    };
  }
  if (delaySec <= -SECONDS_PER_MINUTE) {
    return {
      key: "arrival.liveEarly",
      params: { minutes: Math.round(-delaySec / SECONDS_PER_MINUTE) },
      tone: "live",
    };
  }
  return { key: "arrival.liveOnTime", tone: "live" };
}
