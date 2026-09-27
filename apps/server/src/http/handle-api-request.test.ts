import { INSTALL_ID_HEADER, USER_NAME_HEADER } from "@transit/contracts";
import { CatalogUnavailableError } from "@transit/gtfs";
import { describe, expect, it, vi } from "vitest";
import type { ServerConfigResult } from "../config/server-config";
import { handleApiRequest } from "./handle-api-request";

const OK_CONFIG: ServerConfigResult = {
  ok: true,
  config: { apiKey: "secret", blockedInstallIds: new Set() },
};

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

  it("returns 401 unauthorized even when the install id is blocked (401 wins over 403)", async () => {
    const config: ServerConfigResult = {
      ok: true,
      config: { apiKey: "secret", blockedInstallIds: new Set(["0123456789abcdef"]) },
    };
    const response = await handleApiRequest(
      requestWith({ [INSTALL_ID_HEADER]: "0123456789abcdef" }),
      {},
      { readConfig: () => config },
      async () => Response.json({}),
    );
    expect(response.status).toBe(401);
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

  describe("access control", () => {
    it("returns 403 access_denied without calling the handler for a blocked install id", async () => {
      const config: ServerConfigResult = {
        ok: true,
        config: { apiKey: "secret", blockedInstallIds: new Set(["0123456789abcdef"]) },
      };
      let called = false;
      const response = await handleApiRequest(
        requestWith({ "x-api-key": "secret", [INSTALL_ID_HEADER]: "0123456789abcdef" }),
        {},
        { readConfig: () => config },
        async () => {
          called = true;
          return Response.json({});
        },
      );
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error.code).toBe("access_denied");
      expect(called).toBe(false);
    });

    it("returns 403 access_denied for an install id missing from the allow-list", async () => {
      const config: ServerConfigResult = {
        ok: true,
        config: {
          apiKey: "secret",
          blockedInstallIds: new Set(),
          allowedInstallIds: new Set(["abcdef0123456789"]),
        },
      };
      const response = await handleApiRequest(
        requestWith({ "x-api-key": "secret", [INSTALL_ID_HEADER]: "0123456789abcdef" }),
        {},
        { readConfig: () => config },
        async () => Response.json({}),
      );
      expect(response.status).toBe(403);
    });

    it("calls the handler when the install id is on the allow-list", async () => {
      const config: ServerConfigResult = {
        ok: true,
        config: {
          apiKey: "secret",
          blockedInstallIds: new Set(),
          allowedInstallIds: new Set(["abcdef0123456789"]),
        },
      };
      const response = await handleApiRequest(
        requestWith({ "x-api-key": "secret", [INSTALL_ID_HEADER]: "abcdef0123456789" }),
        {},
        { readConfig: () => config },
        async () => Response.json({ ok: true }),
      );
      expect(response.status).toBe(200);
    });

    it("logs an http.access_denied line with the identity but never coordinates or the API key", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const config: ServerConfigResult = {
        ok: true,
        config: { apiKey: "secret", blockedInstallIds: new Set(["0123456789abcdef"]) },
      };
      await handleApiRequest(
        requestWith({
          "x-api-key": "secret",
          [INSTALL_ID_HEADER]: "0123456789abcdef",
          [USER_NAME_HEADER]: encodeURIComponent("Ana"),
        }),
        {},
        { readConfig: () => config },
        async () => Response.json({}),
      );

      expect(warn).toHaveBeenCalledTimes(1);
      const line = warn.mock.calls[0]?.[0] as string;
      expect(line).toContain('"event":"http.access_denied"');
      expect(line).toContain('"reason":"blocked"');
      expect(line).toContain('"user":"Ana"');
      expect(line).toContain('"installId":"0123456789abcdef"');
      expect(line).not.toContain("secret");
      warn.mockRestore();
    });
  });
});
