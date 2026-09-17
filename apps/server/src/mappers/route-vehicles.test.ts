import { describe, expect, it } from "vitest";
import type { Route, RouteVehiclesResult, Vehicle } from "@transit/core";
import { mapRouteVehiclesResult } from "./route-vehicles";

describe("mapRouteVehiclesResult", () => {
  it("maps routeId, vehicles (with the shared route) and feeds", () => {
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
    const result: RouteVehiclesResult = {
      routeId: "mvta:436",
      route,
      vehicles: [vehicle],
      feeds: [{ feedId: "mvta", ok: true }],
    };
    const response = mapRouteVehiclesResult(result);
    expect(response.routeId).toBe("mvta:436");
    expect(response.vehicles[0]?.routeShortName).toBe("436");
    expect(response.feeds[0]?.feedId).toBe("mvta");
  });
});
