import { describe, expect, it } from "vitest";
import { type ArrivalStatusInput, formatArrivalStatus } from "./arrival-status";

function live(delaySec?: number): ArrivalStatusInput {
  return { source: "live", status: "normal", delaySec };
}

describe("formatArrivalStatus", () => {
  it("marks canceled arrivals as a problem, even when the source is live", () => {
    expect(formatArrivalStatus({ source: "live", status: "canceled" })).toEqual({
      key: "arrival.canceled",
      status: "problem",
    });
  });

  it("marks skipped arrivals as a problem", () => {
    expect(formatArrivalStatus({ source: "scheduled", status: "skipped" })).toEqual({
      key: "arrival.skipped",
      status: "problem",
    });
  });

  it("labels scheduled arrivals as neutral", () => {
    expect(formatArrivalStatus({ source: "scheduled", status: "normal" })).toEqual({
      key: "arrival.scheduled",
      status: "neutral",
    });
  });

  it("labels live arrivals without delay data as on time", () => {
    expect(formatArrivalStatus(live())).toEqual({ key: "arrival.liveOnTime", status: "ok" });
  });

  it("treats delays from -59 s up to 119 s as on time", () => {
    expect(formatArrivalStatus(live(119))).toEqual({ key: "arrival.liveOnTime", status: "ok" });
    expect(formatArrivalStatus(live(0)).key).toBe("arrival.liveOnTime");
    expect(formatArrivalStatus(live(-59))).toEqual({ key: "arrival.liveOnTime", status: "ok" });
  });

  it("reports late from 120 s in rounded minutes", () => {
    expect(formatArrivalStatus(live(120))).toEqual({
      key: "arrival.liveLate",
      params: { minutes: 2 },
      status: "attention",
    });
    expect(formatArrivalStatus(live(200)).params).toEqual({ minutes: 3 });
  });

  it("reports early from -60 s with at least one minute", () => {
    expect(formatArrivalStatus(live(-60))).toEqual({
      key: "arrival.liveEarly",
      params: { minutes: 1 },
      status: "attention",
    });
    expect(formatArrivalStatus(live(-150)).params).toEqual({ minutes: 3 });
  });
});
