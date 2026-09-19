import type { VehicleDetailResult } from "@transit/core";
import { describe, expect, it } from "vitest";
import { authedRequest, fakeTransitService, OK_CONFIG, unauthedRequest } from "./test-helpers";
import { createVehicleDetailHandler } from "./vehicle-detail-handler";

const RESULT: VehicleDetailResult = {
  vehicle: {
    id: "mvta:v1",
    feedId: "mvta",
    lat: 44.9,
    lon: -93.2,
    routeId: "mvta:436",
    directionId: 1,
    tripId: "mvta:t1",
    headsign: "Eagan Transit Station",
    updatedAt: 1000,
  },
  route: {
    id: "mvta:436",
    feedId: "mvta",
    agencyId: "mvta",
    shortName: "436",
    longName: "46th St Station-MSP-Viking Lakes-Eagan",
  },
  upcomingStops: [],
  feeds: [],
};

describe("createVehicleDetailHandler", () => {
  it("returns 200 for a known vehicle", async () => {
    const handler = createVehicleDetailHandler({
      getService: () => fakeTransitService({ getVehicleDetail: async () => RESULT }),
      readConfig: () => OK_CONFIG,
    });
    const response = await handler(authedRequest("https://x/api/v1/vehicles/mvta%3Av1"), {
      params: Promise.resolve({ vehicleId: "mvta:v1" }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns 404 not_found for an unknown or stale vehicle", async () => {
    const handler = createVehicleDetailHandler({
      getService: () => fakeTransitService({ getVehicleDetail: async () => undefined }),
      readConfig: () => OK_CONFIG,
    });
    const response = await handler(authedRequest("https://x/api/v1/vehicles/nope"), {
      params: Promise.resolve({ vehicleId: "nope" }),
    });
    expect(response.status).toBe(404);
  });

  it("returns 400 invalid_request for an empty vehicleId", async () => {
    const handler = createVehicleDetailHandler({
      getService: () => fakeTransitService({}),
      readConfig: () => OK_CONFIG,
    });
    const response = await handler(authedRequest("https://x/api/v1/vehicles/"), {
      params: Promise.resolve({ vehicleId: "" }),
    });
    expect(response.status).toBe(400);
  });

  it("returns 401 unauthorized without an API key", async () => {
    const handler = createVehicleDetailHandler({
      getService: () => fakeTransitService({}),
      readConfig: () => OK_CONFIG,
    });
    const response = await handler(unauthedRequest("https://x/api/v1/vehicles/mvta%3Av1"), {
      params: Promise.resolve({ vehicleId: "mvta:v1" }),
    });
    expect(response.status).toBe(401);
  });
});
