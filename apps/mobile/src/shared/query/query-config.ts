import { QueryClient } from "@tanstack/react-query";

/** Cached data younger than this is served without a request when a panel is reopened. */
export const QUERY_STALE_TIME_MS = 5_000;

/**
 * How long unused data stays in memory, and the longest a persisted response is restored after a
 * restart. Live data older than this is not worth showing, even labeled as stale.
 */
export const QUERY_CACHE_MAX_AGE_MS = 10 * 60 * 1000;

/** Bump to discard every persisted response (for example when a response shape changes). */
export const PERSIST_CACHE_VERSION = "1";

/** Marks a query whose last response is saved to disk and restored on the next app start. */
export const PERSIST_META = { persist: true } as const;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // The poll interval already retries; retries with backoff would only delay the error state.
        retry: false,
        staleTime: QUERY_STALE_TIME_MS,
        gcTime: QUERY_CACHE_MAX_AGE_MS,
      },
    },
  });
}

/** Only successful responses of queries marked with `PERSIST_META` are written to disk. */
export function shouldPersistQuery(query: {
  meta?: Record<string, unknown> | undefined;
  state: { status: string };
}): boolean {
  return query.meta?.persist === true && query.state.status === "success";
}
