import type { NearbyStopDto, VehicleDto } from "@transit/contracts";
import { describe, expect, it } from "vitest";
import { collectApproachingVehicles } from "./collect-approaching-vehicles";

function vehicle(id: string): VehicleDto {
  return {
    id,
    routeId: "mvta:436",
    routeShortName: "436",
    directionId: 0,
    headsign: "Eagan Transit Station",
    tripId: `trip-${id}`,
    updatedAt: 1000,
    lat: 44.9,
    lon: -93.2,
  };
}

function stop(id: string, approachingVehicles: VehicleDto[]): NearbyStopDto {
  return {
    stop: { id, code: id, name: id, lat: 44.9, lon: -93.2 },
    distanceMeters: 100,
    routes: [],
    nextArrivals: [],
    approachingVehicles,
  };
}

describe("collectApproachingVehicles", () => {
  it("returns each vehicle once even when it approaches several stops", () => {
    const shared = vehicle("v1");
    const result = collectApproachingVehicles([
      stop("a", [shared, vehicle("v2")]),
      stop("b", [shared]),
    ]);

    expect(result.map((v) => v.id)).toEqual(["v1", "v2"]);
  });

  it("returns an empty list when no stop has approaching vehicles", () => {
    expect(collectApproachingVehicles([stop("a", [])])).toEqual([]);
  });
});
