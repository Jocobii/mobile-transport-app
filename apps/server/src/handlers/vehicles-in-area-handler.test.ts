import type { VehiclesInAreaResult } from "@transit/core";
import { CatalogUnavailableError } from "@transit/gtfs";
import { describe, expect, it } from "vitest";
import { authedRequest, fakeTransitService, OK_CONFIG, unauthedRequest } from "./test-helpers";
import { createVehiclesInAreaHandler } from "./vehicles-in-area-handler";

const EMPTY_RESULT: VehiclesInAreaResult = { vehicles: [], truncated: false, feeds: [] };
const VALID_BBOX = "bbox=-93.35,44.9,-93.15,45.0";

describe("createVehiclesInAreaHandler", () => {
  it("returns 200 with a no-store cache-control header", async () => {
    const handler = createVehiclesInAreaHandler({
      getService: () => fakeTransitService({ getVehiclesInArea: async () => EMPTY_RESULT }),
      readConfig: () => OK_CONFIG,
    });
    const response = await handler(
      authedRequest(`https://x/api/v1/vehicles/in-area?${VALID_BBOX}`),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ vehicles: [], truncated: false, feeds: [] });
  });

  it("returns 400 invalid_request when bbox is missing", async () => {
    const handler = createVehiclesInAreaHandler({
      getService: () => fakeTransitService({}),
      readConfig: () => OK_CONFIG,
    });
    const response = await handler(authedRequest("https://x/api/v1/vehicles/in-area"));
    expect(response.status).toBe(400);
  });

  it("returns 400 invalid_request when bbox spans more than the configured limit", async () => {
    const handler = createVehiclesInAreaHandler({
      getService: () => fakeTransitService({}),
      readConfig: () => OK_CONFIG,
    });
    const response = await handler(
      authedRequest("https://x/api/v1/vehicles/in-area?bbox=-95,43,-91,47"),
    );
    expect(response.status).toBe(400);
  });

  it("returns 401 unauthorized without an API key", async () => {
    const handler = createVehiclesInAreaHandler({
      getService: () => fakeTransitService({}),
      readConfig: () => OK_CONFIG,
    });
    const response = await handler(
      unauthedRequest(`https://x/api/v1/vehicles/in-area?${VALID_BBOX}`),
    );
    expect(response.status).toBe(401);
  });

  it("returns 503 catalog_unavailable when the catalog is missing", async () => {
    const handler = createVehiclesInAreaHandler({
      getService: () =>
        fakeTransitService({
          getVehiclesInArea: async () => {
            throw new CatalogUnavailableError("missing");
          },
        }),
      readConfig: () => OK_CONFIG,
    });
    const response = await handler(
      authedRequest(`https://x/api/v1/vehicles/in-area?${VALID_BBOX}`),
    );
    expect(response.status).toBe(503);
  });
});
