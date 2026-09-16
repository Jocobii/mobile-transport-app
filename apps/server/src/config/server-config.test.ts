import { describe, expect, it } from "vitest";
import { parseServerConfig } from "./server-config";

describe("parseServerConfig", () => {
  it("returns the config when API_KEY is present", () => {
    expect(parseServerConfig({ API_KEY: "secret" })).toEqual({
      ok: true,
      config: { apiKey: "secret" },
    });
  });

  it("reports API_KEY as missing when it is absent or blank", () => {
    expect(parseServerConfig({})).toEqual({ ok: false, missing: ["API_KEY"] });
    expect(parseServerConfig({ API_KEY: "   " })).toEqual({ ok: false, missing: ["API_KEY"] });
  });
});
