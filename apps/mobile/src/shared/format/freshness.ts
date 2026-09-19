const SECONDS_PER_MINUTE = 60;

/** Seconds elapsed since `timestamp` (epoch seconds); never negative. */
export function secondsSince(timestamp: number, now: number): number {
  return Math.max(0, Math.floor(now - timestamp));
}

/** "panel" starts a sentence ("Actualizado..."); "inline" continues one ("actualizado..."). */
export type FreshnessVariant = "panel" | "inline";

export interface FreshnessLabel {
  key:
    | "freshness.seconds"
    | "freshness.minutes"
    | "freshness.inlineSeconds"
    | "freshness.inlineMinutes";
  params: { seconds: number } | { minutes: number };
}

export function formatFreshness(
  elapsedSeconds: number,
  variant: FreshnessVariant = "panel",
): FreshnessLabel {
  if (elapsedSeconds < SECONDS_PER_MINUTE) {
    return {
      key: variant === "panel" ? "freshness.seconds" : "freshness.inlineSeconds",
      params: { seconds: elapsedSeconds },
    };
  }
  return {
    key: variant === "panel" ? "freshness.minutes" : "freshness.inlineMinutes",
    params: { minutes: Math.floor(elapsedSeconds / SECONDS_PER_MINUTE) },
  };
}
