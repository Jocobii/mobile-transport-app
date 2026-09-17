import type { HealthResult } from "@transit/core";
import { describe, expect, it } from "vitest";
import { createHealthHandler } from "./health-handler";
import { authedRequest, fakeTransitService, OK_CONFIG, unauthedRequest } from "./test-helpers";

const RESULT: HealthResult = { status: "ok", checkedAt: 1000, catalogVersion: "v1", feeds: [] };

describe("createHealthHandler", () => {
  it("returns 200 with the mapped health result", async () => {
    const handler = createHealthHandler({
      getService: () => fakeTransitService({ getHealth: async () => RESULT }),
      readConfig: () => OK_CONFIG,
    });
    const response = await handler(authedRequest("https://x/api/v1/health"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      status: "ok",
      checkedAt: 1000,
      catalogVersion: "v1",
      feeds: [],
    });
  });

  it("returns 401 unauthorized without an API key", async () => {
    const handler = createHealthHandler({
      getService: () => fakeTransitService({}),
      readConfig: () => OK_CONFIG,
    });
    const response = await handler(unauthedRequest("https://x/api/v1/health"));
    expect(response.status).toBe(401);
  });

  it("returns 500 server_misconfigured when the API key is not configured", async () => {
    const handler = createHealthHandler({
      getService: () => fakeTransitService({}),
      readConfig: () => ({ ok: false, missing: ["API_KEY"] }),
    });
    const response = await handler(authedRequest("https://x/api/v1/health"));
    expect(response.status).toBe(500);
  });
});
