import type { RealtimeLagSample } from "@transit/core";

/**
 * One structured line per realtime fetch (per feed, about every `realtimeCacheTtlSeconds` per
 * warm instance), so Vercel logs show how old the agency's vehicle positions already are when we
 * fetch them, apart from the delay our cache and the app's polling add on top.
 */
export function logRealtimeLag(sample: RealtimeLagSample): void {
  console.info(JSON.stringify({ event: "realtime.lag", ...sample }));
}
