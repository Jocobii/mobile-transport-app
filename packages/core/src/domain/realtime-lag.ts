import type { EpochSeconds, FeedId, Vehicle } from "../model";

/**
 * How old one feed's realtime data was when the server fetched it. Used only to measure where the
 * map's vehicle lag comes from (the agency feed vs. our cache and polling); it never changes data.
 */
export interface RealtimeLagSample {
  feedId: FeedId;
  fetchedAt: EpochSeconds;
  /** `fetchedAt` minus the VehiclePositions header timestamp; undefined when unknown. */
  vehicleFeedAgeSec: number | undefined;
  /** `fetchedAt` minus the TripUpdates header timestamp; undefined when unknown. */
  tripFeedAgeSec: number | undefined;
  vehicleCount: number;
  /** Age of each vehicle's own GPS report (`fetchedAt - updatedAt`); undefined with no vehicles. */
  positionAgeSec: { p50: number; p90: number; max: number } | undefined;
}

export interface RealtimeLagInput {
  feedId: FeedId;
  fetchedAt: EpochSeconds;
  vehicleFeedTimestamp: EpochSeconds | undefined;
  tripFeedTimestamp: EpochSeconds | undefined;
  vehicles: ReadonlyArray<Pick<Vehicle, "updatedAt">>;
}

function ageOf(timestamp: EpochSeconds | undefined, now: EpochSeconds): number | undefined {
  return timestamp === undefined ? undefined : Math.max(0, now - timestamp);
}

/** Nearest-rank percentile of an ascending list (0 for an empty one). */
function percentile(sortedAscending: number[], fraction: number): number {
  const rank = Math.ceil(fraction * sortedAscending.length);
  return sortedAscending[Math.max(0, rank - 1)] ?? 0;
}

export function summarizeRealtimeLag(input: RealtimeLagInput): RealtimeLagSample {
  const { feedId, fetchedAt, vehicles } = input;
  const ages = vehicles
    .map((vehicle) => Math.max(0, fetchedAt - vehicle.updatedAt))
    .sort((a, b) => a - b);

  return {
    feedId,
    fetchedAt,
    vehicleFeedAgeSec: ageOf(input.vehicleFeedTimestamp, fetchedAt),
    tripFeedAgeSec: ageOf(input.tripFeedTimestamp, fetchedAt),
    vehicleCount: ages.length,
    positionAgeSec:
      ages.length === 0
        ? undefined
        : { p50: percentile(ages, 0.5), p90: percentile(ages, 0.9), max: percentile(ages, 1) },
  };
}
