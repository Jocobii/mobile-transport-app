const SECONDS_PER_MINUTE = 60;

/** Seconds elapsed since `timestamp` (epoch seconds); never negative. */
export function secondsSince(timestamp: number, now: number): number {
  return Math.max(0, Math.floor(now - timestamp));
}

export interface FreshnessLabel {
  key: "freshness.seconds" | "freshness.minutes";
  params: { seconds: number } | { minutes: number };
}

export function formatFreshness(elapsedSeconds: number): FreshnessLabel {
  if (elapsedSeconds < SECONDS_PER_MINUTE) {
    return { key: "freshness.seconds", params: { seconds: elapsedSeconds } };
  }
  return {
    key: "freshness.minutes",
    params: { minutes: Math.floor(elapsedSeconds / SECONDS_PER_MINUTE) },
  };
}
