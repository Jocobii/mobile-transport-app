import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { REFRESH_INTERVAL_MS } from "../config";
import { createPollController, type PollController } from "./poll-controller";

export interface PolledQueryOptions {
  intervalMs?: number;
  enabled?: boolean;
}

interface QueryState<T> {
  key: string;
  data: T | undefined;
  error: unknown;
  /** Epoch seconds of the last successful response. */
  lastSuccessAt: number | undefined;
}

export interface PolledQuery<T> {
  data: T | undefined;
  error: unknown;
  isInitialLoading: boolean;
  lastSuccessAt: number | undefined;
  refetch: () => void;
}

function emptyState<T>(key: string): QueryState<T> {
  return { key, data: undefined, error: undefined, lastSuccessAt: undefined };
}

const nowInSeconds = () => Math.floor(Date.now() / 1000);

/**
 * Runs `fetcher` when `key` changes and then every `intervalMs` while the app is active.
 * Keeps the last data when a refresh fails; the UI shows an error only when there is no data.
 */
export function usePolledQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  { intervalMs = REFRESH_INTERVAL_MS, enabled = true }: PolledQueryOptions = {},
): PolledQuery<T> {
  const [state, setState] = useState<QueryState<T>>(() => emptyState<T>(key));
  const fetcherRef = useRef(fetcher);
  const controllerRef = useRef<PollController | undefined>(undefined);

  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    if (!enabled) return;

    const controller = createPollController<T>({
      fetcher: () => fetcherRef.current(),
      intervalMs,
      timers: {
        setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
        clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
      },
      now: nowInSeconds,
      onSuccess: (data, at) => setState({ key, data, error: undefined, lastSuccessAt: at }),
      onError: (error) =>
        setState((previous) => ({
          ...(previous.key === key ? previous : emptyState<T>(key)),
          error,
        })),
    });
    controllerRef.current = controller;

    const applyAppState = (status: AppStateStatus) => {
      if (status === "active") controller.resume();
      else controller.pause();
    };
    applyAppState(AppState.currentState);
    const subscription = AppState.addEventListener("change", applyAppState);

    return () => {
      subscription.remove();
      controller.stop();
      controllerRef.current = undefined;
    };
  }, [key, enabled, intervalMs]);

  const refetch = useCallback(() => controllerRef.current?.refetch(), []);

  const current = state.key === key ? state : emptyState<T>(key);
  return {
    data: current.data,
    error: current.error,
    isInitialLoading: enabled && current.data === undefined && current.error === undefined,
    lastSuccessAt: current.lastSuccessAt,
    refetch,
  };
}
