import { describe, expect, it } from "vitest";
import type { ScheduledStopTime, StopTimePrediction, TransitSettings } from "../model";
import { mergeArrivals } from "./merge-arrivals";

const SETTINGS = {
  pastArrivalGraceSeconds: 60,
  arrivalsWindowMinutes: 90,
} as TransitSettings;

const NOW = 1_000_000;

function scheduledRow(overrides: Partial<ScheduledStopTime> = {}): ScheduledStopTime {
  return {
    tripId: "t1",
    routeId: "metrotransit:54",
    directionId: 0,
    headsign: "Downtown",
    stopId: "s1",
    stopSequence: 1,
    serviceDate: "20260916",
    time: NOW + 100,
    ...overrides,
  };
}

function prediction(overrides: Partial<StopTimePrediction> = {}): StopTimePrediction {
  return {
    feedId: "metrotransit",
    tripId: "t1",
    routeId: "metrotransit:54",
    directionId: 0,
    stopId: "s1",
    time: NOW + 150,
    status: "normal",
    ...overrides,
  };
}

describe("mergeArrivals (10.9)", () => {
  it("a matched normal prediction becomes a live arrival with scheduledTime and delaySec", () => {
    const scheduled = [scheduledRow({ serviceDate: "20260916" })];
    const predictions = [prediction({ serviceDate: "20260916" })];
    const [arrival] = mergeArrivals(scheduled, predictions, NOW, SETTINGS);
    expect(arrival?.source).toBe("live");
    expect(arrival?.time).toBe(NOW + 150);
    expect(arrival?.scheduledTime).toBe(NOW + 100);
    expect(arrival?.delaySec).toBe(50);
  });

  it("a matched canceled prediction becomes a canceled live arrival at the scheduled time", () => {
    const scheduled = [scheduledRow({ serviceDate: "20260916" })];
    const predictions = [
      prediction({ serviceDate: "20260916", status: "canceled", time: 0 }),
    ];
    const [arrival] = mergeArrivals(scheduled, predictions, NOW, SETTINGS);
    expect(arrival?.source).toBe("live");
    expect(arrival?.status).toBe("canceled");
    expect(arrival?.time).toBe(NOW + 100);
  });

  it("an unmatched scheduled row becomes a scheduled arrival", () => {
    const scheduled = [scheduledRow()];
    const [arrival] = mergeArrivals(scheduled, [], NOW, SETTINGS);
    expect(arrival?.source).toBe("scheduled");
    expect(arrival?.status).toBe("normal");
    expect(arrival?.time).toBe(NOW + 100);
  });

  it("an unmatched normal prediction in the window becomes a live arrival", () => {
    const predictions = [prediction({ tripId: "unknown-trip", time: NOW + 30 })];
    const [arrival] = mergeArrivals([], predictions, NOW, SETTINGS);
    expect(arrival?.source).toBe("live");
    expect(arrival?.scheduledTime).toBe(undefined);
  });

  it("a serviceDate-less prediction matches the closest scheduled time within 3 hours", () => {
    const scheduled = [
      scheduledRow({ stopSequence: 1, time: NOW - 5000 }),
      scheduledRow({ stopSequence: 2, time: NOW + 100 }),
    ];
    const predictions = [prediction({ time: NOW + 90 })];
    const arrivals = mergeArrivals(scheduled, predictions, NOW, SETTINGS);
    const matched = arrivals.find((a) => a.source === "live");
    expect(matched?.scheduledTime).toBe(NOW + 100);
  });

  it("removes arrivals outside the [now - grace, now + window] range", () => {
    const scheduled = [
      scheduledRow({ stopSequence: 1, time: NOW - 1000 }),
      scheduledRow({ stopSequence: 2, time: NOW + 100 }),
    ];
    const arrivals = mergeArrivals(scheduled, [], NOW, SETTINGS);
    expect(arrivals.length).toBe(1);
    expect(arrivals[0]?.time).toBe(NOW + 100);
  });

  it("sorts by time ascending, then route natural order, then tripId", () => {
    const scheduled = [
      scheduledRow({ tripId: "b", routeId: "metrotransit:54", time: NOW + 100 }),
      scheduledRow({ tripId: "a", routeId: "metrotransit:9", time: NOW + 100 }),
    ];
    const arrivals = mergeArrivals(scheduled, [], NOW, SETTINGS);
    expect(arrivals.map((a) => a.tripId)).toEqual(["a", "b"]);
  });

  it("applies the endpoint limit last (callers slice after merging)", () => {
    const scheduled = [
      scheduledRow({ tripId: "a", time: NOW + 50 }),
      scheduledRow({ tripId: "b", time: NOW + 60 }),
    ];
    const arrivals = mergeArrivals(scheduled, [], NOW, SETTINGS);
    expect(arrivals.length).toBe(2);
    expect(arrivals.slice(0, 1).map((a) => a.tripId)).toEqual(["a"]);
  });
});
