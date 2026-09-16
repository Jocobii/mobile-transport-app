import { API_KEY_HEADER, type ApiErrorBody, type HealthResponse } from "@transit/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const HEALTH_URL = "https://example.test/api/v1/health";

describe("GET /api/v1/health", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns the health report when the API key is valid", async () => {
    vi.stubEnv("API_KEY", "secret");

    const response = await GET(new Request(HEALTH_URL, { headers: { [API_KEY_HEADER]: "secret" } }));
    const body = (await response.json()) as HealthResponse;

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.status).toBe("ok");
    expect(body.feeds).toEqual([]);
    expect(Number.isInteger(body.checkedAt)).toBe(true);
  });

  it("returns 401 when the API key is missing", async () => {
    vi.stubEnv("API_KEY", "secret");

    const response = await GET(new Request(HEALTH_URL));
    const body = (await response.json()) as ApiErrorBody;

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("unauthorized");
  });

  it("returns 500 when the server has no API key configured", async () => {
    vi.stubEnv("API_KEY", "");
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET(new Request(HEALTH_URL, { headers: { [API_KEY_HEADER]: "secret" } }));
    const body = (await response.json()) as ApiErrorBody;

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("server_misconfigured");
  });
});
