import type { UpcomingStopDto, VehicleDto } from "@transit/contracts";
import { describe, expect, it } from "vitest";
import { buildVehicleMapContent } from "./vehicle-map-content";

function upcoming(id: string): UpcomingStopDto {
  return {
    stop: { id, code: id, name: id, lat: 44.9, lon: -93.2 },
    stopSequence: Number(id),
    time: 1000,
    source: "live",
    status: "normal",
  };
}

function vehicle(): VehicleDto {
  return {
    id: "v1",
    routeId: "mvta:436",
    routeShortName: "436",
    directionId: 0,
    headsign: "Eagan Transit Station",
    tripId: "trip-1",
    updatedAt: 1000,
    lat: 44.9,
    lon: -93.2,
  };
}

describe("buildVehicleMapContent", () => {
  it("returns every upcoming stop and the bus", () => {
    const result = buildVehicleMapContent(vehicle(), [upcoming("1"), upcoming("2")]);
    expect(result.stops.map((s) => s.id)).toEqual(["1", "2"]);
    expect(result.vehicles).toEqual([vehicle()]);
  });

  it("dedupes a stop the route revisits", () => {
    const result = buildVehicleMapContent(vehicle(), [upcoming("1"), upcoming("2"), upcoming("1")]);
    expect(result.stops.map((s) => s.id)).toEqual(["1", "2"]);
  });

  it("returns no stops with an empty upcoming list", () => {
    expect(buildVehicleMapContent(vehicle(), [])).toEqual({ stops: [], vehicles: [vehicle()] });
  });

  it("returns no vehicle when there is no data yet", () => {
    expect(buildVehicleMapContent(undefined, [])).toEqual({ stops: [], vehicles: [] });
  });
});
