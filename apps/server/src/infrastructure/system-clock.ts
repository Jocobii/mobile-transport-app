import type { Clock } from "@transit/core";

/** Wall-clock time, in Unix epoch seconds. */
export function createSystemClock(): Clock {
  return {
    now: () => Math.floor(Date.now() / 1000),
  };
}
