import type { UpcomingStopDto } from "@transit/contracts";

export interface StopsUntil {
  /** Stops the vehicle still serves before the target (0 = the target is the next stop). */
  remaining: number;
  target?: UpcomingStopDto | undefined;
  /** True when the target is not in the upcoming stops: the vehicle already went by it. */
  passed: boolean;
}

/** Where the user's stop sits in the vehicle's ordered upcoming stops. */
export function stopsUntil(upcomingStops: UpcomingStopDto[], stopId: string): StopsUntil {
  const index = upcomingStops.findIndex((upcoming) => upcoming.stop.id === stopId);
  if (index === -1) return { remaining: 0, passed: true };
  return { remaining: index, target: upcomingStops[index], passed: false };
}
