import type { EpochSeconds, FeedStatus, TransitSettings, Vehicle } from "../model";
import type { RealtimeSnapshot } from "../ports";

/** A feed is stale when its data is older than `realtimeStaleAfterSeconds`, or unknown. */
export function isFeedStale(
  status: Pick<FeedStatus, "dataTimestamp">,
  now: EpochSeconds,
  settings: TransitSettings,
): boolean {
  if (status.dataTimestamp === undefined) return true;
  return now - status.dataTimestamp > settings.realtimeStaleAfterSeconds;
}

/** A vehicle is stale when it hasn't reported a position within `realtimeStaleAfterSeconds`. */
export function isVehicleStale(
  vehicle: Pick<Vehicle, "updatedAt">,
  now: EpochSeconds,
  settings: TransitSettings,
): boolean {
  return now - vehicle.updatedAt > settings.realtimeStaleAfterSeconds;
}

/**
 * Applies the 10.8 freshness rules to a raw snapshot: a stale feed contributes no
 * vehicles and no predictions and reports `ok: false`; otherwise, stale vehicles
 * (but not predictions, which are already time-windowed at normalization) are removed.
 */
export function applyFreshnessRules(
  snapshot: RealtimeSnapshot,
  now: EpochSeconds,
  settings: TransitSettings,
): RealtimeSnapshot {
  if (isFeedStale(snapshot.status, now, settings)) {
    return {
      ...snapshot,
      vehicles: [],
      predictions: [],
      status: { ...snapshot.status, ok: false },
    };
  }

  return {
    ...snapshot,
    vehicles: snapshot.vehicles.filter((vehicle) => !isVehicleStale(vehicle, now, settings)),
  };
}
