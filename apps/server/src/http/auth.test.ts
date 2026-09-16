import { API_KEY_HEADER } from "@transit/contracts";
import { describe, expect, it } from "vitest";
import { hasValidApiKey } from "./auth";

function requestWithHeaders(headers: Record<string, string>): Request {
  return new Request("https://example.test/api/v1/health", { headers });
}

describe("hasValidApiKey", () => {
  it("accepts the expected key", () => {
    expect(hasValidApiKey(requestWithHeaders({ [API_KEY_HEADER]: "secret" }), "secret")).toBe(true);
  });

  it("rejects a different key", () => {
    expect(hasValidApiKey(requestWithHeaders({ [API_KEY_HEADER]: "wrong" }), "secret")).toBe(false);
  });

  it("rejects a request without the header", () => {
    expect(hasValidApiKey(requestWithHeaders({}), "secret")).toBe(false);
  });
});
