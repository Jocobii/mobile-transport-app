import { INSTALL_ID_HEADER, USER_NAME_HEADER } from "@transit/contracts";
import { describe, expect, it } from "vitest";
import { readClientIdentity } from "./client-identity";

function requestWith(headers: Record<string, string>): Request {
  return new Request("https://example.test/api/v1/health", { headers });
}

describe("readClientIdentity", () => {
  it("returns both fields undefined when no identity headers are sent", () => {
    expect(readClientIdentity(requestWith({}))).toEqual({
      userName: undefined,
      installId: undefined,
    });
  });

  it("decodes and trims a valid encoded name", () => {
    const identity = readClientIdentity(
      requestWith({ [USER_NAME_HEADER]: encodeURIComponent("  José 🚌  ") }),
    );
    expect(identity.userName).toBe("José 🚌");
  });

  it("reports an undecodable value as <invalid>", () => {
    const identity = readClientIdentity(requestWith({ [USER_NAME_HEADER]: "%" }));
    expect(identity.userName).toBe("<invalid>");
  });

  it("truncates a name longer than 30 characters (after trim)", () => {
    const longName = "a".repeat(35);
    const identity = readClientIdentity(requestWith({ [USER_NAME_HEADER]: longName }));
    expect(identity.userName).toBe("a".repeat(30));
  });

  it("treats a name that is empty after trim as absent", () => {
    const identity = readClientIdentity(requestWith({ [USER_NAME_HEADER]: "%20%20" }));
    expect(identity.userName).toBeUndefined();
  });

  it("accepts a valid 16-char lowercase hex install id", () => {
    const identity = readClientIdentity(requestWith({ [INSTALL_ID_HEADER]: "0123456789abcdef" }));
    expect(identity.installId).toBe("0123456789abcdef");
  });

  it("lowercases and trims a well-formed install id", () => {
    const identity = readClientIdentity(requestWith({ [INSTALL_ID_HEADER]: " 0123456789ABCDEF " }));
    expect(identity.installId).toBe("0123456789abcdef");
  });

  it("treats a malformed install id as missing", () => {
    expect(readClientIdentity(requestWith({ [INSTALL_ID_HEADER]: "too-short" })).installId).toBe(
      undefined,
    );
    expect(
      readClientIdentity(requestWith({ [INSTALL_ID_HEADER]: "0123456789abcdefg" })).installId,
    ).toBe(undefined);
    expect(
      readClientIdentity(requestWith({ [INSTALL_ID_HEADER]: "not-hex-at-all!!" })).installId,
    ).toBe(undefined);
  });
});
