import type { RouteVehiclesResponse, VehicleDto } from "@transit/contracts";
import { describe, expect, it } from "vitest";
import { collectRouteVehicles } from "./filtered-vehicles";

function vehicle(id: string, routeId: string): VehicleDto {
  return {
    id,
    routeId,
    routeShortName: routeId,
    directionId: 0,
    headsign: "",
    tripId: `${id}:trip`,
    lat: 44.9,
    lon: -93.2,
    updatedAt: 0,
  };
}

function ok(routeId: string, ...ids: string[]): PromiseFulfilledResult<RouteVehiclesResponse> {
  return {
    status: "fulfilled",
    value: { routeId, vehicles: ids.map((id) => vehicle(id, routeId)), feeds: [] },
  };
}

function failed(message: string): PromiseRejectedResult {
  return { status: "rejected", reason: new Error(message) };
}

describe("collectRouteVehicles", () => {
  it("flattens the vehicles of every route", () => {
    const vehicles = collectRouteVehicles([ok("a", "1", "2"), ok("b", "3")]);
    expect(vehicles.map((item) => item.id)).toEqual(["1", "2", "3"]);
  });

  it("keeps one entry per vehicle id", () => {
    const vehicles = collectRouteVehicles([ok("a", "1"), ok("b", "1", "2")]);
    expect(vehicles.map((item) => item.id)).toEqual(["1", "2"]);
  });

  it("skips a route whose request failed when another succeeded", () => {
    const vehicles = collectRouteVehicles([failed("boom"), ok("b", "3")]);
    expect(vehicles.map((item) => item.id)).toEqual(["3"]);
  });

  it("throws the first error when every request failed", () => {
    expect(() => collectRouteVehicles([failed("first"), failed("second")])).toThrow("first");
  });

  it("returns nothing for routes without vehicles", () => {
    expect(collectRouteVehicles([ok("a"), ok("b")])).toEqual([]);
  });
});
