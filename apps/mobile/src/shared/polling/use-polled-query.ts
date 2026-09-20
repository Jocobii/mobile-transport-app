import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { REFRESH_INTERVAL_MS } from "../config";
import { PERSIST_META } from "../query/query-config";

export interface PolledQueryOptions {
  intervalMs?: number;
  enabled?: boolean;
  /**
   * Keeps showing the previous key's data while the next one loads. For queries where "the same
   * thing, moved" (a wider area, another filter) is better than a spinner; never for a different
   * entity (another stop or vehicle).
   */
  keepPreviousData?: boolean;
  /** Saves the last response to disk and shows it right away on the next app start. */
  persist?: boolean;
}

export interface PolledQuery<T> {
  data: T | undefined;
  error: unknown;
  isInitialLoading: boolean;
  /** A request is in flight (poll, refetch or first load). */
  isFetching: boolean;
  /** Epoch seconds of the last successful response (also when it was restored from disk). */
  lastSuccessAt: number | undefined;
  refetch: () => void;
}

interface QueryResultLike<T> {
  data: T | undefined;
  error: unknown;
  isFetching: boolean;
  /** Epoch milliseconds of the last successful response. */
  dataUpdatedAt: number;
}

/**
 * Maps a TanStack Query result to the shape the panels consume. The last data is kept when a
 * refresh fails; the UI shows an error only when there is no data.
 */
export function toPolledQuery<T>(
  result: QueryResultLike<T>,
  enabled: boolean,
  refetch: () => void,
): PolledQuery<T> {
  const hasData = result.data !== undefined;
  return {
    data: result.data,
    error: result.error ?? undefined,
    isInitialLoading: enabled && !hasData && (result.error ?? undefined) === undefined,
    isFetching: enabled && result.isFetching,
    lastSuccessAt: hasData ? Math.floor(result.dataUpdatedAt / 1000) : undefined,
    refetch,
  };
}

/**
 * Loads `fetcher` under `key` and refreshes it every `intervalMs` while the app is in the
 * foreground. Responses are cached by key: reopening a panel shows its last data at once and
 * refreshes it when older than the stale time; identical responses keep the same reference.
 */
export function usePolledQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  {
    intervalMs = REFRESH_INTERVAL_MS,
    enabled = true,
    keepPreviousData: keepPrevious = false,
    persist = false,
  }: PolledQueryOptions = {},
): PolledQuery<T> {
  const query = useQuery<T>({
    queryKey: [key],
    queryFn: fetcher,
    enabled,
    refetchInterval: intervalMs,
    refetchIntervalInBackground: false,
    ...(keepPrevious ? { placeholderData: keepPreviousData } : {}),
    ...(persist ? { meta: PERSIST_META } : {}),
  });

  const { refetch: refetchQuery } = query;
  const refetch = useCallback(() => {
    void refetchQuery();
  }, [refetchQuery]);

  return toPolledQuery(query, enabled, refetch);
}
