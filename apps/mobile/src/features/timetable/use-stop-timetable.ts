import type { StopTimetableResponse } from "@transit/contracts";
import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/api/client";

interface TimetableState {
  key: string;
  data?: StopTimetableResponse;
  error?: unknown;
}

export interface StopTimetableQuery {
  data: StopTimetableResponse | undefined;
  error: unknown;
  isLoading: boolean;
  retry: () => void;
}

/**
 * Scheduled timetable of one stop and day. Catalog data, so it is fetched once per
 * `(stopId, date)` (no polling); `date` undefined lets the server pick today.
 * Idle while `stopId` is undefined.
 */
export function useStopTimetable(
  stopId: string | undefined,
  date: string | undefined,
): StopTimetableQuery {
  const [state, setState] = useState<TimetableState | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);
  const key = stopId === undefined ? "" : `${stopId}:${date ?? ""}`;

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` re-runs the fetch on retry.
  useEffect(() => {
    if (stopId === undefined) return;
    let cancelled = false;
    const requestKey = `${stopId}:${date ?? ""}`;
    apiClient
      .getStopTimetable(stopId, date === undefined ? {} : { date })
      .then((data) => {
        if (!cancelled) setState({ key: requestKey, data });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ key: requestKey, error });
      });
    return () => {
      cancelled = true;
    };
  }, [stopId, date, attempt]);

  const retry = useCallback(() => {
    setState(undefined);
    setAttempt((value) => value + 1);
  }, []);

  const current = state !== undefined && state.key === key ? state : undefined;
  return {
    data: current?.data,
    error: current?.error,
    isLoading: stopId !== undefined && current === undefined,
    retry,
  };
}
