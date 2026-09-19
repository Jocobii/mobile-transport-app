import { describe, expect, it } from "vitest";
import type { Arrival, Vehicle } from "../model";
import { approachingVehicles } from "./approaching-vehicles";

const NOW = 1000;

function vehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: "v1",
    feedId: "metrotransit",
    lat: 44.9,
    lon: -93.2,
    routeId: "metrotransit:54",
    directionId: 0,
    tripId: "t1",
    headsign: "Downtown",
    updatedAt: NOW,
    ...overrides,
  };
}

function arrival(overrides: Partial<Arrival> = {}): Arrival {
  return {
    stopId: "s1",
    routeId: "metrotransit:54",
    directionId: 0,
    tripId: "t1",
    headsign: "Downtown",
    stopSequence: 5,
    time: NOW + 100,
    source: "live",
    status: "normal",
    ...overrides,
  };
}

describe("approachingVehicles (10.10)", () => {
  it("includes a vehicle whose current stop sequence is unknown", () => {
    const v = vehicle();
    const result = approachingVehicles([arrival()], [v], NOW);
    expect(result.map((x) => x.id)).toEqual(["v1"]);
  });

  it("includes a vehicle whose current stop sequence is at or before the arrival's", () => {
    const v = vehicle({ currentStopSequence: 3 });
    const result = approachingVehicles([arrival({ stopSequence: 5 })], [v], NOW);
    expect(result.map((x) => x.id)).toEqual(["v1"]);
  });

  it("excludes a vehicle that has already passed the arrival's stop sequence", () => {
    const v = vehicle({ currentStopSequence: 10 });
    const result = approachingVehicles([arrival({ stopSequence: 5 })], [v], NOW);
    expect(result.length).toBe(0);
  });

  it("excludes arrivals that are not status normal or already in the past", () => {
    const v = vehicle();
    const canceled = arrival({ status: "canceled" });
    const past = arrival({ time: NOW - 100 });
    expect(approachingVehicles([canceled], [v], NOW).length).toBe(0);
    expect(approachingVehicles([past], [v], NOW).length).toBe(0);
  });

  it("includes a vehicle at most once, ordered like its matched arrival", () => {
    const v1 = vehicle({ id: "v1", tripId: "t1" });
    const v2 = vehicle({ id: "v2", tripId: "t2" });
    const arrivals = [
      arrival({ tripId: "t2", time: NOW + 10 }),
      arrival({ tripId: "t1", time: NOW + 20 }),
      arrival({ tripId: "t1", time: NOW + 30 }),
    ];
    const result = approachingVehicles(arrivals, [v1, v2], NOW);
    expect(result.map((x) => x.id)).toEqual(["v2", "v1"]);
  });
});
