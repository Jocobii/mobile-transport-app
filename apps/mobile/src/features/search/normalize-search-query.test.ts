import { describe, expect, it } from "vitest";
import { SEARCH_MAX_LENGTH } from "@/shared/config";
import { normalizeSearchQuery } from "./normalize-search-query";

describe("normalizeSearchQuery", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeSearchQuery("  436 ")).toBe("436");
  });

  it("returns undefined for an empty or blank query", () => {
    expect(normalizeSearchQuery("")).toBeUndefined();
    expect(normalizeSearchQuery("   ")).toBeUndefined();
  });

  it("caps the query at the server limit", () => {
    const result = normalizeSearchQuery("a".repeat(SEARCH_MAX_LENGTH + 20));
    expect(result).toHaveLength(SEARCH_MAX_LENGTH);
  });
});
