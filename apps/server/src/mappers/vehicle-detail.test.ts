import { describe, expect, it } from "vitest";
import type { Route, Stop, Vehicle, VehicleDetailResult } from "@transit/core";
import { mapVehicleDetailResult } from "./vehicle-detail";

describe("mapVehicleDetailResult", () => {
  it("maps vehicle, route, upcoming stops and feeds", () => {
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
      updatedAt: 1000,
    };
    const stop: Stop = {
      id: "eagan",
      code: "eagan",
      name: "Eagan Transit Station",
      lat: 44.8,
      lon: -93.16,
      feedIds: [],
    };
    const result: VehicleDetailResult = {
      vehicle,
      route,
      feeds: [{ feedId: "mvta", ok: true }],
      upcomingStops: [
        {
          stop,
          stopSequence: 1,
          time: 1000,
          source: "scheduled",
          status: "normal",
        },
      ],
    };
    const response = mapVehicleDetailResult(result);
    expect(response.vehicle.id).toBe("mvta:v1");
    expect(response.vehicle.routeShortName).toBe("436");
    expect(response.route.id).toBe("mvta:436");
    expect(response.upcomingStops[0]?.stop.id).toBe("eagan");
    expect(response.feeds[0]?.feedId).toBe("mvta");
  });
});
