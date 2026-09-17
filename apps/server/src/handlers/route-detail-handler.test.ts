import { describe, expect, it } from "vitest";
import { InvalidDirectionError } from "@transit/core";
import type { RouteDetailResult } from "@transit/core";
import { createRouteDetailHandler } from "./route-detail-handler";
import { authedRequest, fakeTransitService, OK_CONFIG, unauthedRequest } from "./test-helpers";

const RESULT: RouteDetailResult = {
  route: {
    id: "mvta:436",
    feedId: "mvta",
    agencyId: "mvta",
    shortName: "436",
    longName: "46th St Station-MSP-Viking Lakes-Eagan",
  },
  directions: [{ directionId: 0, headsign: "MSP" }],
  selectedDirectionId: 0,
  stops: [],
  shape: [],
};

describe("createRouteDetailHandler", () => {
  it("returns 200 for a known route", async () => {
    const handler = createRouteDetailHandler({
      getService: () => fakeTransitService({ getRouteDetail: async () => RESULT }),
      readConfig: () => OK_CONFIG,
    });
    const response = await handler(
      authedRequest("https://x/api/v1/routes/mvta%3A436"),
      { params: Promise.resolve({ routeId: "mvta:436" }) },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, max-age=300");
  });

  it("returns 404 not_found for an unknown route", async () => {
    const handler = createRouteDetailHandler({
      getService: () => fakeTransitService({ getRouteDetail: async () => undefined }),
      readConfig: () => OK_CONFIG,
    });
    const response = await handler(
      authedRequest("https://x/api/v1/routes/unknown%3A1"),
      { params: Promise.resolve({ routeId: "unknown:1" }) },
    );
    expect(response.status).toBe(404);
  });

  it("returns 400 invalid_request for an invalid directionId", async () => {
    const handler = createRouteDetailHandler({
      getService: () => fakeTransitService({}),
      readConfig: () => OK_CONFIG,
    });
    const response = await handler(
      authedRequest("https://x/api/v1/routes/mvta%3A436?directionId=2"),
      { params: Promise.resolve({ routeId: "mvta:436" }) },
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 invalid_request for only one of lat/lon", async () => {
    const handler = createRouteDetailHandler({
      getService: () => fakeTransitService({}),
      readConfig: () => OK_CONFIG,
    });
    const response = await handler(
      authedRequest("https://x/api/v1/routes/mvta%3A436?lat=1"),
      { params: Promise.resolve({ routeId: "mvta:436" }) },
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 invalid_request when the service reports an invalid direction", async () => {
    const handler = createRouteDetailHandler({
      getService: () =>
        fakeTransitService({
          getRouteDetail: async () => {
            throw new InvalidDirectionError("mvta:436", 1);
          },
        }),
      readConfig: () => OK_CONFIG,
    });
    const response = await handler(
      authedRequest("https://x/api/v1/routes/mvta%3A436?directionId=1"),
      { params: Promise.resolve({ routeId: "mvta:436" }) },
    );
    expect(response.status).toBe(400);
  });

  it("returns 401 unauthorized without an API key", async () => {
    const handler = createRouteDetailHandler({
      getService: () => fakeTransitService({}),
      readConfig: () => OK_CONFIG,
    });
    const response = await handler(
      unauthedRequest("https://x/api/v1/routes/mvta%3A436"),
      { params: Promise.resolve({ routeId: "mvta:436" }) },
    );
    expect(response.status).toBe(401);
  });
});
