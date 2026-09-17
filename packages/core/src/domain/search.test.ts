import { describe, expect, it } from "vitest";
import { isValidNormalizedQuery, normalizeQuery, variantSuffixQuery } from "./search";

describe("normalizeQuery (10.6)", () => {
  it("trims, collapses whitespace, lowercases and strips diacritics", () => {
    expect(normalizeQuery("  MÉXICO   436V ")).toBe("mexico 436v");
  });

  it("normalizes an already-clean query to itself", () => {
    expect(normalizeQuery("436")).toBe("436");
  });
});

describe("isValidNormalizedQuery (10.6)", () => {
  it("rejects an empty query", () => {
    expect(isValidNormalizedQuery("")).toBe(false);
    expect(isValidNormalizedQuery(normalizeQuery("   "))).toBe(false);
  });

  it("accepts a non-empty query", () => {
    expect(isValidNormalizedQuery("436")).toBe(true);
  });
});

describe("variantSuffixQuery (10.6 variant suffix rule)", () => {
  it("strips a trailing single letter from a digit+letter route query", () => {
    expect(variantSuffixQuery("436v")).toBe("436");
  });

  it("returns undefined for a query that isn't a route-with-variant", () => {
    expect(variantSuffixQuery("436")).toBe(undefined);
    expect(variantSuffixQuery("terminal 1")).toBe(undefined);
    expect(variantSuffixQuery("4v3")).toBe(undefined);
  });
});
