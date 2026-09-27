import { describe, expect, it } from "vitest";
import { generateInstallId, normalizeUserName, USER_NAME_MAX_LENGTH } from "./identity-rules";

describe("normalizeUserName", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeUserName("  Ana  ")).toBe("Ana");
  });

  it("returns undefined for an empty or whitespace-only name", () => {
    expect(normalizeUserName("")).toBeUndefined();
    expect(normalizeUserName("   ")).toBeUndefined();
  });

  it(`accepts a name of exactly ${USER_NAME_MAX_LENGTH} characters`, () => {
    const name = "a".repeat(USER_NAME_MAX_LENGTH);
    expect(normalizeUserName(name)).toBe(name);
  });

  it(`rejects a name of ${USER_NAME_MAX_LENGTH + 1} characters (after trim)`, () => {
    const name = "a".repeat(USER_NAME_MAX_LENGTH + 1);
    expect(normalizeUserName(name)).toBeUndefined();
  });

  it("counts length after trimming", () => {
    const padded = ` ${"a".repeat(USER_NAME_MAX_LENGTH)} `;
    expect(normalizeUserName(padded)).toBe("a".repeat(USER_NAME_MAX_LENGTH));
  });
});

describe("generateInstallId", () => {
  it("returns 16 lowercase hex characters", () => {
    expect(generateInstallId()).toMatch(/^[0-9a-f]{16}$/);
  });

  it("uses the injected random source deterministically", () => {
    expect(generateInstallId(() => 0)).toBe("0000000000000000");
    expect(generateInstallId(() => 0.999999)).toBe("ffffffffffffffff");
  });
});
