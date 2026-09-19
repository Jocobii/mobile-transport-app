import { describe, expect, it } from "vitest";
import { type ArrivalTimeInput, formatArrivalTime } from "./arrival-time";

const NOW = 1_800_000_000;
const LABELS = { now: "NOW", minutesUnit: "MIN" };

function localEpoch(hours: number, minutes: number): number {
  return new Date(2026, 8, 18, hours, minutes).getTime() / 1000;
}

function normal(time: number): ArrivalTimeInput {
  return { time, status: "normal" };
}

describe("formatArrivalTime", () => {
  it("shows the 'now' label when the arrival is less than a minute away", () => {
    expect(formatArrivalTime(normal(NOW + 59), NOW, LABELS)).toEqual({
      primary: "NOW",
      unit: "",
      struck: false,
    });
  });

  it("shows the 'now' label when the arrival time is already in the past", () => {
    expect(formatArrivalTime(normal(NOW - 30), NOW, LABELS).primary).toBe("NOW");
  });

  it("shows whole minutes, rounded down, under one hour", () => {
    expect(formatArrivalTime(normal(NOW + 60), NOW, LABELS)).toEqual({
      primary: "1",
      unit: "MIN",
      struck: false,
    });
    expect(formatArrivalTime(normal(NOW + 3599), NOW, LABELS).primary).toBe("59");
  });

  it("shows a 12-hour clock time without suffix from one hour on", () => {
    const now = localEpoch(9, 0);
    expect(formatArrivalTime(normal(localEpoch(15, 5)), now, LABELS)).toEqual({
      primary: "3:05",
      unit: "",
      struck: false,
    });
    expect(formatArrivalTime(normal(localEpoch(12, 30)), now, LABELS).primary).toBe("12:30");
    expect(formatArrivalTime(normal(localEpoch(10, 0)), now, LABELS).primary).toBe("10:00");
  });

  it("shows the scheduled clock time, struck, for a canceled arrival", () => {
    const arrival: ArrivalTimeInput = {
      time: localEpoch(8, 15),
      scheduledTime: localEpoch(8, 10),
      status: "canceled",
    };
    expect(formatArrivalTime(arrival, localEpoch(8, 0), LABELS)).toEqual({
      primary: "8:10",
      unit: "",
      struck: true,
    });
  });

  it("falls back to the arrival time when a skipped arrival has no scheduled time", () => {
    const arrival: ArrivalTimeInput = { time: localEpoch(0, 5), status: "skipped" };
    expect(formatArrivalTime(arrival, localEpoch(0, 0), LABELS)).toMatchObject({
      primary: "12:05",
      struck: true,
    });
  });
});
