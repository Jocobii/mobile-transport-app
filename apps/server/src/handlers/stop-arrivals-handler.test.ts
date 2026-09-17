import type { StopArrivalsResult } from "@transit/core";
import { CatalogUnavailableError } from "@transit/gtfs";
import { describe, expect, it } from "vitest";
import { createStopArrivalsHandler } from "./stop-arrivals-handler";
import { authedRequest, fakeTransitService, OK_CONFIG, unauthedRequest } from "./test-helpers";

const RESULT: StopArrivalsResult = {
  stop: { id: "56939", code: "56939", name: "MSP T1", lat: 44.88, lon: -93.2, feedIds: [] },
  routes: [],
  arrivals: [],
  feeds: [],
};

describe("createStopArrivalsHandler", () => {
  it("returns 200 for a known stop", async () => {
    const handler = createStopArrivalsHandler({
      getService: () => fakeTransitService({ getStopArrivals: async () => RESULT }),
      readConfig: () => OK_CONFIG,
    });
    const response = await handler(authedRequest("https://x/api/v1/stops/56939/arrivals"), {
      params: Promise.resolve({ stopId: "56939" }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns 404 not_found for an unknown stop", async () => {
    const handler = createStopArrivalsHandler({
      getService: () => fakeTransitService({ getStopArrivals: async () => undefined }),
      readConfig: () => OK_CONFIG,
    });
    const response = await handler(authedRequest("https://x/api/v1/stops/nope/arrivals"), {
      params: Promise.resolve({ stopId: "nope" }),
    });
    expect(response.status).toBe(404);
  });

  it("returns 400 invalid_request for an empty stopId", async () => {
    const handler = createStopArrivalsHandler({
      getService: () => fakeTransitService({}),
      readConfig: () => OK_CONFIG,
    });
    const response = await handler(authedRequest("https://x/api/v1/stops//arrivals"), {
      params: Promise.resolve({ stopId: "" }),
    });
    expect(response.status).toBe(400);
  });

  it("returns 401 unauthorized without an API key", async () => {
    const handler = createStopArrivalsHandler({
      getService: () => fakeTransitService({}),
      readConfig: () => OK_CONFIG,
    });
    const response = await handler(unauthedRequest("https://x/api/v1/stops/56939/arrivals"), {
      params: Promise.resolve({ stopId: "56939" }),
    });
    expect(response.status).toBe(401);
  });

  it("returns 503 catalog_unavailable when the catalog is missing", async () => {
    const handler = createStopArrivalsHandler({
      getService: () =>
        fakeTransitService({
          getStopArrivals: async () => {
            throw new CatalogUnavailableError("missing");
          },
        }),
      readConfig: () => OK_CONFIG,
    });
    const response = await handler(authedRequest("https://x/api/v1/stops/56939/arrivals"), {
      params: Promise.resolve({ stopId: "56939" }),
    });
    expect(response.status).toBe(503);
  });
});
