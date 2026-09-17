import type { RouteVehiclesResult } from "@transit/core";
import { describe, expect, it } from "vitest";
import { createRouteVehiclesHandler } from "./route-vehicles-handler";
import { authedRequest, fakeTransitService, OK_CONFIG, unauthedRequest } from "./test-helpers";

const RESULT: RouteVehiclesResult = {
  routeId: "mvta:436",
  route: {
    id: "mvta:436",
    feedId: "mvta",
    agencyId: "mvta",
    shortName: "436",
    longName: "46th St Station-MSP-Viking Lakes-Eagan",
  },
  vehicles: [],
  feeds: [],
};

describe("createRouteVehiclesHandler", () => {
  it("returns 200 for a known route, even with no vehicles", async () => {
    const handler = createRouteVehiclesHandler({
      getService: () => fakeTransitService({ getRouteVehicles: async () => RESULT }),
      readConfig: () => OK_CONFIG,
    });
    const response = await handler(authedRequest("https://x/api/v1/routes/mvta%3A436/vehicles"), {
      params: Promise.resolve({ routeId: "mvta:436" }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.json()).vehicles).toEqual([]);
  });

  it("returns 404 not_found for an unknown route", async () => {
    const handler = createRouteVehiclesHandler({
      getService: () => fakeTransitService({ getRouteVehicles: async () => undefined }),
      readConfig: () => OK_CONFIG,
    });
    const response = await handler(authedRequest("https://x/api/v1/routes/unknown%3A1/vehicles"), {
      params: Promise.resolve({ routeId: "unknown:1" }),
    });
    expect(response.status).toBe(404);
  });

  it("returns 400 invalid_request for an invalid directionId", async () => {
    const handler = createRouteVehiclesHandler({
      getService: () => fakeTransitService({}),
      readConfig: () => OK_CONFIG,
    });
    const response = await handler(
      authedRequest("https://x/api/v1/routes/mvta%3A436/vehicles?directionId=x"),
      { params: Promise.resolve({ routeId: "mvta:436" }) },
    );
    expect(response.status).toBe(400);
  });

  it("returns 401 unauthorized without an API key", async () => {
    const handler = createRouteVehiclesHandler({
      getService: () => fakeTransitService({}),
      readConfig: () => OK_CONFIG,
    });
    const response = await handler(unauthedRequest("https://x/api/v1/routes/mvta%3A436/vehicles"), {
      params: Promise.resolve({ routeId: "mvta:436" }),
    });
    expect(response.status).toBe(401);
  });
});
