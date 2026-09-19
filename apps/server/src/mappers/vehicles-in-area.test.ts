import type { Route, Vehicle, VehiclesInAreaResult } from "@transit/core";
import { describe, expect, it } from "vitest";
import { mapVehiclesInAreaResult } from "./vehicles-in-area";

describe("mapVehiclesInAreaResult", () => {
  it("maps each vehicle with its own route, and the truncated flag and feeds", () => {
    const route: Route = {
      id: "mvta:436",
      feedId: "mvta",
      agencyId: "mvta",
      shortName: "436",
      longName: "46th St Station-MSP-Viking Lakes-Eagan",
    };
    const vehicle: Vehicle = {
      id: "mvta:v1",
      feedId: "mvta",
      lat: 44.9,
      lon: -93.2,
      routeId: "mvta:436",
      directionId: 1,
      tripId: "mvta:t1",
      headsign: "Eagan Transit Station",
      updatedAt: 1000,
    };
    const result: VehiclesInAreaResult = {
      vehicles: [{ vehicle, route }],
      truncated: true,
      feeds: [{ feedId: "mvta", ok: true }],
    };

    const response = mapVehiclesInAreaResult(result);
    expect(response.vehicles[0]?.routeShortName).toBe("436");
    expect(response.truncated).toBe(true);
    expect(response.feeds[0]?.feedId).toBe("mvta");
  });
});
