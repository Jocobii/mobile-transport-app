/** A route number with a one-letter variant suffix, e.g. `436v`. Generic, not route-specific. */
export const VARIANT_SUFFIX_PATTERN = /^\d+[a-z]$/;

/**
 * Normalizes a raw search query (10.6): trim, collapse internal whitespace, lowercase,
 * strip diacritics. Callers reject the result when `isValidNormalizedQuery` is false.
 */
export function normalizeQuery(raw: string): string {
  return raw.normalize("NFD").replace(/\p{M}/gu, "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function isValidNormalizedQuery(query: string): boolean {
  return query.length > 0;
}

/**
 * The variant-suffix retry query (10.6): for `436v` this is `436`, so a search that
 * misses on the exact route number can retry without a one-letter variant suffix.
 * Returns `undefined` when `query` doesn't look like a route-with-variant.
 */
export function variantSuffixQuery(query: string): string | undefined {
  return VARIANT_SUFFIX_PATTERN.test(query) ? query.slice(0, -1) : undefined;
}
