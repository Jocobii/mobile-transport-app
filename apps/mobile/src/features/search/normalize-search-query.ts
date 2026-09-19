import { SEARCH_MAX_LENGTH } from "@/shared/config";

/** Trimmed and capped query, or undefined when there is nothing to search for. */
export function normalizeSearchQuery(raw: string): string | undefined {
  const query = raw.trim().slice(0, SEARCH_MAX_LENGTH).trim();
  return query === "" ? undefined : query;
}
