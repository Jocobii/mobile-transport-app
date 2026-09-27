import { describe, expect, it } from "vitest";
import type { ServerConfig } from "@/config/server-config";
import { checkAccess } from "./access";

function configWith(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    apiKey: "secret",
    blockedInstallIds: new Set(),
    ...overrides,
  };
}

describe("checkAccess", () => {
  it("allows a request with no identity when no lists are configured", () => {
    expect(checkAccess({}, configWith())).toEqual({ ok: true });
  });

  it("allows a request with an identity when no lists are configured", () => {
    expect(checkAccess({ userName: "Ana", installId: "0123456789abcdef" }, configWith())).toEqual({
      ok: true,
    });
  });

  it("rejects a blocked install id", () => {
    const config = configWith({ blockedInstallIds: new Set(["0123456789abcdef"]) });
    expect(checkAccess({ installId: "0123456789abcdef" }, config)).toEqual({
      ok: false,
      reason: "blocked",
    });
  });

  it("allows an install id not on the block-list", () => {
    const config = configWith({ blockedInstallIds: new Set(["0123456789abcdef"]) });
    expect(checkAccess({ installId: "abcdef0123456789" }, config)).toEqual({ ok: true });
  });

  it("allows a listed install id when an allow-list is configured", () => {
    const config = configWith({ allowedInstallIds: new Set(["abcdef0123456789"]) });
    expect(checkAccess({ installId: "abcdef0123456789" }, config)).toEqual({ ok: true });
  });

  it("rejects an unlisted install id when an allow-list is configured", () => {
    const config = configWith({ allowedInstallIds: new Set(["abcdef0123456789"]) });
    expect(checkAccess({ installId: "0123456789abcdef" }, config)).toEqual({
      ok: false,
      reason: "not_allowed",
    });
  });

  it("rejects a missing install id when an allow-list is configured", () => {
    const config = configWith({ allowedInstallIds: new Set(["abcdef0123456789"]) });
    expect(checkAccess({}, config)).toEqual({ ok: false, reason: "not_allowed" });
  });

  it("rejects as blocked when the id is in both lists", () => {
    const config = configWith({
      blockedInstallIds: new Set(["0123456789abcdef"]),
      allowedInstallIds: new Set(["0123456789abcdef"]),
    });
    expect(checkAccess({ installId: "0123456789abcdef" }, config)).toEqual({
      ok: false,
      reason: "blocked",
    });
  });
});
