import type { ArrivalDto, NearbyStopDto, NearbyStopsResponse } from "@transit/contracts";
import { describe, expect, it } from "vitest";
import { groupNearbyByRoute } from "./group-nearby-by-route";

function arrival(overrides: Partial<ArrivalDto> = {}): ArrivalDto {
  return {
    tripId: "t1",
    routeId: "metrotransit:68",
    routeShortName: "68",
    directionId: 0,
    headsign: "Downtown",
    time: 1000,
    source: "live",
    status: "normal",
    ...overrides,
  };
}

function nearbyStop(id: string, distanceMeters: number, arrivals: ArrivalDto[]): NearbyStopDto {
  return {
    stop: { id, code: id, name: `Stop ${id}`, lat: 44.9, lon: -93.2 },
    distanceMeters,
    routes: [],
    nextArrivals: arrivals,
    approachingVehicles: [],
  };
}

function response(stops: NearbyStopDto[]): NearbyStopsResponse {
  return { stops, outsideRadius: false, feeds: [] };
}

describe("groupNearbyByRoute", () => {
  it("uses the nearest stop that serves the same route and destination", () => {
    const far = nearbyStop("far", 400, [arrival({ tripId: "a", time: 900 })]);
    const near = nearbyStop("near", 100, [arrival({ tripId: "b", time: 1200 })]);
    const groups = groupNearbyByRoute(response([far, near]));
    expect(groups).toHaveLength(1);
    expect(groups[0]?.stop.id).toBe("near");
    expect(groups[0]?.distanceMeters).toBe(100);
    expect(groups[0]?.arrivals.map((a) => a.tripId)).toEqual(["b"]);
  });

  it("creates one row per headsign of the same route", () => {
    const stop = nearbyStop("s", 50, [
      arrival({ tripId: "a", headsign: "Downtown", time: 1000 }),
      arrival({ tripId: "b", headsign: "Airport", time: 1100 }),
    ]);
    const groups = groupNearbyByRoute(response([stop]));
    expect(groups.map((g) => g.headsign)).toEqual(["Downtown", "Airport"]);
  });

  it("produces no rows for stops without arrivals", () => {
    expect(groupNearbyByRoute(response([nearbyStop("s", 50, [])]))).toEqual([]);
  });

  it("orders rows by their first arrival time and keeps two normal times per row", () => {
    const stop = nearbyStop("s", 50, [
      arrival({ tripId: "late", routeId: "m:54", routeShortName: "54", time: 3000 }),
      arrival({ tripId: "a1", time: 1000 }),
      arrival({ tripId: "a2", time: 1600 }),
      arrival({ tripId: "a3", time: 2200 }),
    ]);
    const groups = groupNearbyByRoute(response([stop]));
    expect(groups.map((g) => g.routeShortName)).toEqual(["68", "54"]);
    expect(groups[0]?.arrivals.map((a) => a.tripId)).toEqual(["a1", "a2"]);
  });

  it("shows a canceled arrival only when it is the first one, followed by the next normal", () => {
    const stop = nearbyStop("s", 50, [
      arrival({ tripId: "x", status: "canceled", time: 900 }),
      arrival({ tripId: "n1", time: 1000 }),
      arrival({ tripId: "n2", time: 1600 }),
    ]);
    const [group] = groupNearbyByRoute(response([stop]));
    expect(group?.arrivals.map((a) => a.tripId)).toEqual(["x", "n1"]);
  });

  it("hides a canceled arrival that is not the first one", () => {
    const stop = nearbyStop("s", 50, [
      arrival({ tripId: "n1", time: 1000 }),
      arrival({ tripId: "x", status: "skipped", time: 1300 }),
      arrival({ tripId: "n2", time: 1600 }),
    ]);
    const [group] = groupNearbyByRoute(response([stop]));
    expect(group?.arrivals.map((a) => a.tripId)).toEqual(["n1", "n2"]);
  });

  it("carries the official route colors from the arrival", () => {
    const stop = nearbyStop("s", 50, [
      arrival({ routeColor: "#771473", routeTextColor: "#FFFFFF" }),
    ]);
    const [group] = groupNearbyByRoute(response([stop]));
    expect(group?.routeColor).toBe("#771473");
    expect(group?.routeTextColor).toBe("#FFFFFF");
  });
});
