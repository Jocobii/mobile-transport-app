export interface ClockTimers {
  setInterval(callback: () => void, delayMs: number): unknown;
  clearInterval(handle: unknown): void;
}

export interface Clock {
  /** Calls `listener` with the current epoch seconds every tick; returns the unsubscribe. */
  subscribe(listener: (nowSeconds: number) => void): () => void;
}

const TICK_MS = 1000;

/**
 * One shared ticker for every component that needs the time. It only runs while someone is
 * subscribed, so many rows cost one timer, not one each. Timers and clock are injected for tests.
 */
export function createClock(timers: ClockTimers, nowSeconds: () => number): Clock {
  const listeners = new Set<(nowSeconds: number) => void>();
  let handle: unknown;

  function tick(): void {
    const now = nowSeconds();
    for (const listener of [...listeners]) listener(now);
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) handle = timers.setInterval(tick, TICK_MS);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          timers.clearInterval(handle);
          handle = undefined;
        }
      };
    },
  };
}

export const nowInSeconds = () => Math.floor(Date.now() / 1000);

/** The app's clock: ticks once a second while at least one component listens. */
export const appClock: Clock = createClock(
  {
    setInterval: (callback, delayMs) => setInterval(callback, delayMs),
    clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
  },
  nowInSeconds,
);
