import type { NearbyStopDto, StopSummaryDto, VehicleDto } from "@transit/contracts";
import { describe, expect, it } from "vitest";
import { resolveVehicleStop } from "./resolve-vehicle-stop";

function stopSummary(id: string): StopSummaryDto {
  return { id, code: id, name: id, lat: 44.9, lon: -93.2 };
}

function vehicleRef(id: string): VehicleDto {
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

function nearbyStop(
  id: string,
  distanceMeters: number,
  approachingVehicleIds: string[],
): NearbyStopDto {
  return {
    stop: stopSummary(id),
    distanceMeters,
    routes: [],
    nextArrivals: [],
    approachingVehicles: approachingVehicleIds.map(vehicleRef),
  };
}

describe("resolveVehicleStop", () => {
  it("picks my stop when the bus approaches it, even if a closer stop also has it", () => {
    const nearbyStops = [nearbyStop("close", 50, ["v1"]), nearbyStop("mine", 200, ["v1"])];
    expect(resolveVehicleStop("v1", nearbyStops, "mine")).toBe("mine");
  });

  it("returns no stop when my stop is not approached, even if another Nearby stop is", () => {
    const nearbyStops = [nearbyStop("mine", 50, ["v2"]), nearbyStop("near", 100, ["v1"])];
    expect(resolveVehicleStop("v1", nearbyStops, "mine")).toBeUndefined();
  });

  it("never picks a stop automatically when nothing is highlighted", () => {
    const nearbyStops = [nearbyStop("far", 300, ["v1"]), nearbyStop("near", 100, ["v1"])];
    expect(resolveVehicleStop("v1", nearbyStops, undefined)).toBeUndefined();
  });

  it("returns no stop when the bus approaches none of the Nearby stops", () => {
    const nearbyStops = [nearbyStop("a", 50, ["v2"]), nearbyStop("b", 100, ["v3"])];
    expect(resolveVehicleStop("v1", nearbyStops, undefined)).toBeUndefined();
  });

  it("returns no stop when there is no Nearby data", () => {
    expect(resolveVehicleStop("v1", undefined, "mine")).toBeUndefined();
  });
});
