import { describe, expect, it } from "vitest";
import { parseServerConfig } from "./server-config";

describe("parseServerConfig", () => {
  it("returns the config when API_KEY is present", () => {
    expect(parseServerConfig({ API_KEY: "secret" })).toEqual({
      ok: true,
      config: {
        apiKey: "secret",
        cronSecret: undefined,
        catalogDeployHookUrl: undefined,
        catalogPath: undefined,
      },
    });
  });

  it("reports API_KEY as missing when it is absent or blank", () => {
    expect(parseServerConfig({})).toEqual({ ok: false, missing: ["API_KEY"] });
    expect(parseServerConfig({ API_KEY: "   " })).toEqual({ ok: false, missing: ["API_KEY"] });
  });

  it("reads the optional cron and catalog variables when present", () => {
    const result = parseServerConfig({
      API_KEY: "secret",
      CRON_SECRET: "cron-secret",
      CATALOG_DEPLOY_HOOK_URL: "https://api.vercel.com/v1/integrations/deploy/abc",
      CATALOG_PATH: "/tmp/catalog.sqlite",
    });
    expect(result).toEqual({
      ok: true,
      config: {
        apiKey: "secret",
        cronSecret: "cron-secret",
        catalogDeployHookUrl: "https://api.vercel.com/v1/integrations/deploy/abc",
        catalogPath: "/tmp/catalog.sqlite",
      },
    });
  });

  it("treats blank optional variables as absent", () => {
    const result = parseServerConfig({ API_KEY: "secret", CRON_SECRET: "   " });
    expect(result).toEqual({
      ok: true,
      config: {
        apiKey: "secret",
        cronSecret: undefined,
        catalogDeployHookUrl: undefined,
        catalogPath: undefined,
      },
    });
  });
});
