import { CatalogUnavailableError } from "@transit/gtfs";
import { describe, expect, it } from "vitest";
import type { ServerConfigResult } from "../config/server-config";
import { handleApiRequest } from "./handle-api-request";

const OK_CONFIG: ServerConfigResult = { ok: true, config: { apiKey: "secret" } };

function requestWith(headers: Record<string, string> = {}): Request {
  return new Request("https://example.test/api/v1/health", { headers });
}

describe("handleApiRequest", () => {
  it("returns 500 server_misconfigured without calling the handler on bad config", async () => {
    let called = false;
    const response = await handleApiRequest(
      requestWith(),
      {},
      { readConfig: () => ({ ok: false, missing: ["API_KEY"] }) },
      async () => {
        called = true;
        return Response.json({});
      },
    );
    expect(response.status).toBe(500);
    expect(called).toBe(false);
  });

  it("returns 401 unauthorized without calling the handler when no API key is given", async () => {
    let called = false;
    const response = await handleApiRequest(
      requestWith(),
      {},
      { readConfig: () => OK_CONFIG },
      async () => {
        called = true;
        return Response.json({});
      },
    );
    expect(response.status).toBe(401);
    expect(called).toBe(false);
  });

  it("calls the handler and returns its response when authenticated", async () => {
    const response = await handleApiRequest(
      requestWith({ "x-api-key": "secret" }),
      { stopId: "56939" },
      { readConfig: () => OK_CONFIG },
      async (_request, context) => Response.json({ echo: context.stopId }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ echo: "56939" });
  });

  it("maps a thrown CatalogUnavailableError to 503 catalog_unavailable", async () => {
    const response = await handleApiRequest(
      requestWith({ "x-api-key": "secret" }),
      {},
      { readConfig: () => OK_CONFIG },
      async () => {
        throw new CatalogUnavailableError("missing");
      },
    );
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error.code).toBe("catalog_unavailable");
  });

  it("maps any other thrown error to 500 internal_error", async () => {
    const response = await handleApiRequest(
      requestWith({ "x-api-key": "secret" }),
      {},
      { readConfig: () => OK_CONFIG },
      async () => {
        throw new Error("boom");
      },
    );
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("internal_error");
  });
});
