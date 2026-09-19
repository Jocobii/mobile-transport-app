import { describe, expect, it } from "vitest";
import { type ArrivalStatusInput, formatArrivalStatus } from "./arrival-status";

function live(delaySec?: number): ArrivalStatusInput {
  return { source: "live", status: "normal", delaySec };
}

describe("formatArrivalStatus", () => {
  it("marks canceled arrivals as a problem, even when the source is live", () => {
    expect(formatArrivalStatus({ source: "live", status: "canceled" })).toEqual({
      key: "arrival.canceled",
      tone: "problem",
    });
  });

  it("marks skipped arrivals as a problem", () => {
    expect(formatArrivalStatus({ source: "scheduled", status: "skipped" })).toEqual({
      key: "arrival.skipped",
      tone: "problem",
    });
  });

  it("labels scheduled arrivals as scheduled", () => {
    expect(formatArrivalStatus({ source: "scheduled", status: "normal" })).toEqual({
      key: "arrival.scheduled",
      tone: "scheduled",
    });
  });

  it("labels live arrivals without delay data as on time", () => {
    expect(formatArrivalStatus(live())).toEqual({ key: "arrival.liveOnTime", tone: "live" });
  });

  it("treats a delay under one minute, in either direction, as on time", () => {
    expect(formatArrivalStatus(live(59)).key).toBe("arrival.liveOnTime");
    expect(formatArrivalStatus(live(-59)).key).toBe("arrival.liveOnTime");
  });

  it("reports late live arrivals in rounded minutes", () => {
    expect(formatArrivalStatus(live(60))).toEqual({
      key: "arrival.liveLate",
      params: { minutes: 1 },
      tone: "live",
    });
    expect(formatArrivalStatus(live(200)).params).toEqual({ minutes: 3 });
  });

  it("reports early live arrivals in rounded minutes", () => {
    expect(formatArrivalStatus(live(-120))).toEqual({
      key: "arrival.liveEarly",
      params: { minutes: 2 },
      tone: "live",
    });
  });
});
