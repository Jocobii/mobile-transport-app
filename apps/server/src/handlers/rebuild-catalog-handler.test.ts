import { describe, expect, it } from "vitest";
import type { ServerConfigResult } from "@/config/server-config";
import { createRebuildCatalogHandler } from "./rebuild-catalog-handler";

const OK_CRON_CONFIG: ServerConfigResult = {
  ok: true,
  config: {
    apiKey: "secret",
    cronSecret: "cron-secret",
    catalogDeployHookUrl: "https://deploy.example/hook",
  },
};

function cronRequest(token?: string): Request {
  return new Request("https://x/api/cron/rebuild-catalog", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe("createRebuildCatalogHandler", () => {
  it("returns 401 unauthorized when the bearer token does not match", async () => {
    const handler = createRebuildCatalogHandler({ readConfig: () => OK_CRON_CONFIG });
    const response = await handler(cronRequest("wrong-secret"));
    expect(response.status).toBe(401);
  });

  it("returns 401 unauthorized without an authorization header", async () => {
    const handler = createRebuildCatalogHandler({ readConfig: () => OK_CRON_CONFIG });
    const response = await handler(cronRequest());
    expect(response.status).toBe(401);
  });

  it("returns 500 server_misconfigured when API_KEY itself is missing", async () => {
    const handler = createRebuildCatalogHandler({
      readConfig: () => ({ ok: false, missing: ["API_KEY"] }),
    });
    const response = await handler(cronRequest("cron-secret"));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("server_misconfigured");
  });

  it("returns 500 server_misconfigured when CRON_SECRET or CATALOG_DEPLOY_HOOK_URL is missing", async () => {
    const handler = createRebuildCatalogHandler({
      readConfig: () => ({ ok: true, config: { apiKey: "secret" } }),
    });
    const response = await handler(cronRequest("cron-secret"));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("server_misconfigured");
  });

  it("returns 200 triggered:true when the deploy hook succeeds", async () => {
    let calledUrl: string | undefined;
    let calledMethod: string | undefined;
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calledUrl = url;
      calledMethod = init?.method;
      return new Response(null, { status: 200 });
    }) as typeof fetch;

    const handler = createRebuildCatalogHandler({ readConfig: () => OK_CRON_CONFIG, fetchImpl });
    const response = await handler(cronRequest("cron-secret"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ triggered: true });
    expect(calledUrl).toBe("https://deploy.example/hook");
    expect(calledMethod).toBe("POST");
  });

  it("returns 502 internal_error when the deploy hook responds with a non-2xx status", async () => {
    const fetchImpl = (async () => new Response(null, { status: 500 })) as typeof fetch;
    const handler = createRebuildCatalogHandler({ readConfig: () => OK_CRON_CONFIG, fetchImpl });
    const response = await handler(cronRequest("cron-secret"));
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error.code).toBe("internal_error");
  });

  it("returns 502 internal_error when the deploy hook fetch throws", async () => {
    const fetchImpl = (async () => {
      throw new Error("network down");
    }) as typeof fetch;
    const handler = createRebuildCatalogHandler({ readConfig: () => OK_CRON_CONFIG, fetchImpl });
    const response = await handler(cronRequest("cron-secret"));
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error.code).toBe("internal_error");
  });
});
