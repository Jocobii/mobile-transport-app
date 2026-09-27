import { VEHICLE_POSITION_WARN_AFTER_SECONDS } from "@/shared/config";

const SECONDS_PER_MINUTE = 60;

/** Seconds elapsed since `timestamp` (epoch seconds); never negative. */
export function secondsSince(timestamp: number, now: number): number {
  return Math.max(0, Math.floor(now - timestamp));
}

/**
 * True when a vehicle's GPS report (`ageSeconds` old) is past `VEHICLE_POSITION_WARN_AFTER_SECONDS`:
 * the map and the Vehicle view flag it so the user doesn't trust a spot the bus may have left.
 */
export function isPositionOutdated(ageSeconds: number): boolean {
  return ageSeconds > VEHICLE_POSITION_WARN_AFTER_SECONDS;
}

/**
 * Whole minutes to show next to an outdated position ("1 min", "2 min"...), never below 1;
 * `undefined` while the position is still fresh (nothing is shown).
 */
export function outdatedPositionMinutes(ageSeconds: number): number | undefined {
  if (!isPositionOutdated(ageSeconds)) return undefined;
  return Math.max(1, Math.floor(ageSeconds / SECONDS_PER_MINUTE));
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
