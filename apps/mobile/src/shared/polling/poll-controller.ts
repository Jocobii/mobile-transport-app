export type TimerHandle = unknown;

export interface PollTimers {
  setTimeout(callback: () => void, delayMs: number): TimerHandle;
  clearTimeout(handle: TimerHandle): void;
}

export interface PollControllerOptions<T> {
  fetcher: () => Promise<T>;
  intervalMs: number;
  timers: PollTimers;
  /** Current time in epoch seconds. */
  now: () => number;
  onSuccess: (data: T, at: number) => void;
  onError: (error: unknown) => void;
}

export interface PollController {
  /** Fetches immediately and keeps polling. Also used to start polling after `pause()`. */
  resume(): void;
  /** Stops polling until `resume()`. A response still in flight is ignored. */
  pause(): void;
  /** Fetches immediately and restarts the interval. No-op while paused. */
  refetch(): void;
  /** Permanently stops; no callback fires afterwards. */
  stop(): void;
}

/**
 * Polling scheduler with injected timers and clock (no React, no AppState).
 * The next poll is scheduled after the previous one settles, so requests never pile up.
 * Only the response of the latest request is applied.
 */
export function createPollController<T>(options: PollControllerOptions<T>): PollController {
  const { fetcher, intervalMs, timers, now, onSuccess, onError } = options;

  let timer: TimerHandle | undefined;
  let latestRequestId = 0;
  let paused = true;
  let stopped = false;

  function clearTimer(): void {
    if (timer === undefined) return;
    timers.clearTimeout(timer);
    timer = undefined;
  }

  function scheduleNext(): void {
    clearTimer();
    timer = timers.setTimeout(() => {
      timer = undefined;
      void run();
    }, intervalMs);
  }

  function isCurrent(requestId: number): boolean {
    return !stopped && !paused && requestId === latestRequestId;
  }

  async function run(): Promise<void> {
    clearTimer();
    latestRequestId += 1;
    const requestId = latestRequestId;
    try {
      const data = await fetcher();
      if (!isCurrent(requestId)) return;
      onSuccess(data, now());
    } catch (error) {
      if (!isCurrent(requestId)) return;
      onError(error);
    }
    scheduleNext();
  }

  return {
    resume() {
      if (stopped) return;
      paused = false;
      void run();
    },
    pause() {
      paused = true;
      clearTimer();
    },
    refetch() {
      if (stopped || paused) return;
      void run();
    },
    stop() {
      stopped = true;
      clearTimer();
    },
  };
}
