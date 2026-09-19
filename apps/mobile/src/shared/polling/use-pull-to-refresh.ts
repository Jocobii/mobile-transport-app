import { useCallback, useEffect, useRef, useState } from "react";

const SAFETY_TIMEOUT_MS = 8000;

/**
 * Pull-to-refresh state for a polled query: shows the spinner until a new successful response
 * arrives (or a safety timeout passes, e.g. when the refresh fails).
 */
export function usePullToRefresh(refetch: () => void, lastSuccessAt: number | undefined) {
  const [refreshing, setRefreshing] = useState(false);
  const startedFrom = useRef<number | undefined>(undefined);

  const onRefresh = useCallback(() => {
    startedFrom.current = lastSuccessAt;
    setRefreshing(true);
    refetch();
  }, [lastSuccessAt, refetch]);

  useEffect(() => {
    if (refreshing && lastSuccessAt !== startedFrom.current) setRefreshing(false);
  }, [lastSuccessAt, refreshing]);

  useEffect(() => {
    if (!refreshing) return;
    const timer = setTimeout(() => setRefreshing(false), SAFETY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [refreshing]);

  return { refreshing, onRefresh };
}
