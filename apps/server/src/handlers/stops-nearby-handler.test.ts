import type { NearbyResult } from "@transit/core";
import { CatalogUnavailableError } from "@transit/gtfs";
import { describe, expect, it } from "vitest";
import { createStopsNearbyHandler } from "./stops-nearby-handler";
import { authedRequest, fakeTransitService, OK_CONFIG, unauthedRequest } from "./test-helpers";

const EMPTY_RESULT: NearbyResult = { stops: [], outsideRadius: false, feeds: [] };

describe("createStopsNearbyHandler", () => {
  it("returns 200 with the mapped result on a valid request", async () => {
    const handler = createStopsNearbyHandler({
      getService: () => fakeTransitService({ getNearby: async () => EMPTY_RESULT }),
      readConfig: () => OK_CONFIG,
    });
    const response = await handler(
      authedRequest("https://x/api/v1/stops/nearby?lat=44.88&lon=-93.2"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ stops: [], outsideRadius: false, feeds: [] });
  });

  it("returns 400 invalid_request for an out-of-range lat", async () => {
    const handler = createStopsNearbyHandler({
      getService: () => fakeTransitService({}),
      readConfig: () => OK_CONFIG,
    });
    const response = await handler(authedRequest("https://x/api/v1/stops/nearby?lat=999&lon=0"));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("invalid_request");
  });

  it("returns 401 unauthorized without an API key", async () => {
    const handler = createStopsNearbyHandler({
      getService: () => fakeTransitService({}),
      readConfig: () => OK_CONFIG,
    });
    const response = await handler(unauthedRequest("https://x/api/v1/stops/nearby?lat=0&lon=0"));
    expect(response.status).toBe(401);
  });

  it("returns 503 catalog_unavailable when the catalog is missing", async () => {
    const handler = createStopsNearbyHandler({
      getService: () =>
        fakeTransitService({
          getNearby: async () => {
            throw new CatalogUnavailableError("missing");
          },
        }),
      readConfig: () => OK_CONFIG,
    });
    const response = await handler(authedRequest("https://x/api/v1/stops/nearby?lat=0&lon=0"));
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe("catalog_unavailable");
  });
});
