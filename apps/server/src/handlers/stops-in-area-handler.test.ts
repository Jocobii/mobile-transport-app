import type { StopsInAreaResult } from "@transit/core";
import { CatalogUnavailableError } from "@transit/gtfs";
import { describe, expect, it } from "vitest";
import { createStopsInAreaHandler } from "./stops-in-area-handler";
import { authedRequest, fakeTransitService, OK_CONFIG, unauthedRequest } from "./test-helpers";

const EMPTY_RESULT: StopsInAreaResult = { stops: [], truncated: false };
const VALID_BBOX = "bbox=-93.28,44.97,-93.25,44.99";

describe("createStopsInAreaHandler", () => {
  it("returns 200 with a catalog cache-control header", async () => {
    const handler = createStopsInAreaHandler({
      getService: () => fakeTransitService({ getStopsInArea: async () => EMPTY_RESULT }),
      readConfig: () => OK_CONFIG,
    });
    const response = await handler(authedRequest(`https://x/api/v1/stops/in-area?${VALID_BBOX}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, max-age=300");
    expect(await response.json()).toEqual({ stops: [], truncated: false });
  });

  it("returns 400 invalid_request when bbox is missing", async () => {
    const handler = createStopsInAreaHandler({
      getService: () => fakeTransitService({}),
      readConfig: () => OK_CONFIG,
    });
    const response = await handler(authedRequest("https://x/api/v1/stops/in-area"));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("invalid_request");
  });

  it("returns 400 invalid_request when bbox spans more than the configured limit", async () => {
    const handler = createStopsInAreaHandler({
      getService: () => fakeTransitService({}),
      readConfig: () => OK_CONFIG,
    });
    const response = await handler(
      authedRequest("https://x/api/v1/stops/in-area?bbox=-93.4,44.8,-93.2,45.0"),
    );
    expect(response.status).toBe(400);
  });

  it("returns 401 unauthorized without an API key", async () => {
    const handler = createStopsInAreaHandler({
      getService: () => fakeTransitService({}),
      readConfig: () => OK_CONFIG,
    });
    const response = await handler(unauthedRequest(`https://x/api/v1/stops/in-area?${VALID_BBOX}`));
    expect(response.status).toBe(401);
  });

  it("returns 503 catalog_unavailable when the catalog is missing", async () => {
    const handler = createStopsInAreaHandler({
      getService: () =>
        fakeTransitService({
          getStopsInArea: async () => {
            throw new CatalogUnavailableError("missing");
          },
        }),
      readConfig: () => OK_CONFIG,
    });
    const response = await handler(authedRequest(`https://x/api/v1/stops/in-area?${VALID_BBOX}`));
    expect(response.status).toBe(503);
  });
});
