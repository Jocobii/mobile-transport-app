import { describe, expect, it } from "vitest";
import type { RealtimeSnapshot } from "../ports";
import type { TransitSettings } from "../settings";
import { applyFreshnessRules, isFeedStale, isVehicleStale } from "./freshness";

const SETTINGS = { realtimeStaleAfterSeconds: 120 } as TransitSettings;

describe("isFeedStale (10.8)", () => {
  it("is stale when dataTimestamp is unknown", () => {
    expect(isFeedStale({}, 1000, SETTINGS)).toBe(true);
  });

  it("is stale when older than realtimeStaleAfterSeconds", () => {
    expect(isFeedStale({ dataTimestamp: 700 }, 1000, SETTINGS)).toBe(true);
  });

  it("is fresh within realtimeStaleAfterSeconds", () => {
    expect(isFeedStale({ dataTimestamp: 950 }, 1000, SETTINGS)).toBe(false);
  });
});

describe("isVehicleStale (10.8)", () => {
  it("is stale when the vehicle hasn't updated within realtimeStaleAfterSeconds", () => {
    expect(isVehicleStale({ updatedAt: 700 }, 1000, SETTINGS)).toBe(true);
  });

  it("is fresh within realtimeStaleAfterSeconds", () => {
    expect(isVehicleStale({ updatedAt: 950 }, 1000, SETTINGS)).toBe(false);
  });
});

describe("applyFreshnessRules (10.8)", () => {
  it("empties vehicles and predictions and forces ok: false for a stale feed", () => {
    const snapshot: RealtimeSnapshot = {
      feedId: "f",
      vehicles: [
        {
          id: "v1",
          feedId: "f",
          lat: 1,
          lon: 1,
          routeId: "r",
          directionId: 0,
          tripId: "t1",
          headsign: "Downtown",
          updatedAt: 950,
        },
      ],
      predictions: [
        {
          feedId: "f",
          tripId: "t1",
          routeId: "r",
          directionId: 0,
          stopId: "s1",
          time: 1000,
          status: "normal",
        },
      ],
      status: { feedId: "f", ok: true, dataTimestamp: 700, fetchedAt: 1000 },
    };
    const result = applyFreshnessRules(snapshot, 1000, SETTINGS);
    expect(result.vehicles.length).toBe(0);
    expect(result.predictions.length).toBe(0);
    expect(result.status.ok).toBe(false);
  });

  it("removes only stale vehicles for a fresh feed, keeping predictions", () => {
    const snapshot: RealtimeSnapshot = {
      feedId: "f",
      vehicles: [
        {
          id: "fresh",
          feedId: "f",
          lat: 1,
          lon: 1,
          routeId: "r",
          directionId: 0,
          tripId: "t1",
          headsign: "Downtown",
          updatedAt: 950,
        },
        {
          id: "stale",
          feedId: "f",
          lat: 1,
          lon: 1,
          routeId: "r",
          directionId: 0,
          tripId: "t2",
          headsign: "Downtown",
          updatedAt: 700,
        },
      ],
      predictions: [
        {
          feedId: "f",
          tripId: "t1",
          routeId: "r",
          directionId: 0,
          stopId: "s1",
          time: 1000,
          status: "normal",
        },
      ],
      status: { feedId: "f", ok: true, dataTimestamp: 950, fetchedAt: 1000 },
    };
    const result = applyFreshnessRules(snapshot, 1000, SETTINGS);
    expect(result.vehicles.map((v) => v.id)).toEqual(["fresh"]);
    expect(result.predictions.length).toBe(1);
  });
});
