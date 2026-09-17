import type {
  Arrival,
  EpochSeconds,
  ScheduledStopTime,
  StopTimePrediction,
  TransitSettings,
} from "../model";
import { compareRoutesNaturally } from "./natural-order";

const SERVICE_DATE_LESS_MATCH_WINDOW_SECONDS = 3 * 60 * 60;

function scheduledKey(tripId: string, serviceDate: string, stopId: string): string {
  return `${tripId}|${serviceDate}|${stopId}`;
}

/**
 * Rule 1 (exact key) when the prediction carries a service date; rule 2 (closest scheduled
 * time for the same trip and stop, within 3 hours) when it doesn't.
 */
function matchScheduledRow(
  prediction: StopTimePrediction,
  scheduledByKey: Map<string, ScheduledStopTime>,
  scheduled: ScheduledStopTime[],
): ScheduledStopTime | undefined {
  if (prediction.serviceDate !== undefined) {
    return scheduledByKey.get(
      scheduledKey(prediction.tripId, prediction.serviceDate, prediction.stopId),
    );
  }

  let best: ScheduledStopTime | undefined;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const row of scheduled) {
    if (row.tripId !== prediction.tripId || row.stopId !== prediction.stopId) continue;
    const diff = Math.abs(row.time - prediction.time);
    if (diff < bestDiff) {
      best = row;
      bestDiff = diff;
    }
  }
  return best && bestDiff <= SERVICE_DATE_LESS_MATCH_WINDOW_SECONDS ? best : undefined;
}

export interface ScheduleMergeResult {
  /** Arrivals for matched predictions (rules 3-4) and unmatched scheduled rows (rule 5). */
  arrivals: Arrival[];
  /** Predictions that matched no scheduled row (candidates for rule 6, unwindowed here). */
  unmatchedPredictions: StopTimePrediction[];
}

/**
 * Matches predictions to scheduled rows and applies 10.9 rules 3-5: a matched normal
 * prediction becomes a live arrival with `scheduledTime`/`delaySec`; a matched canceled
 * or skipped prediction becomes a live arrival at the scheduled time; an unmatched
 * scheduled row becomes a scheduled arrival. Pure, unwindowed and unsorted - callers
 * that need the full stop-arrivals behavior (rule 6, windowing, sorting) use
 * `mergeArrivals`; callers that only need rules 3-5 (e.g. a single trip's upcoming
 * stops) use this directly.
 */
export function mergeScheduleWithPredictions(
  scheduled: ScheduledStopTime[],
  predictions: StopTimePrediction[],
): ScheduleMergeResult {
  const scheduledByKey = new Map<string, ScheduledStopTime>();
  for (const row of scheduled) {
    scheduledByKey.set(scheduledKey(row.tripId, row.serviceDate, row.stopId), row);
  }

  const matchedScheduledKeys = new Set<string>();
  const arrivals: Arrival[] = [];
  const unmatchedPredictions: StopTimePrediction[] = [];

  for (const prediction of predictions) {
    const matched = matchScheduledRow(prediction, scheduledByKey, scheduled);
    if (!matched) {
      unmatchedPredictions.push(prediction);
      continue;
    }

    matchedScheduledKeys.add(scheduledKey(matched.tripId, matched.serviceDate, matched.stopId));

    if (prediction.status === "normal") {
      arrivals.push({
        stopId: matched.stopId,
        routeId: matched.routeId,
        directionId: matched.directionId,
        tripId: matched.tripId,
        headsign: matched.headsign,
        stopSequence: matched.stopSequence,
        time: prediction.time,
        scheduledTime: matched.time,
        delaySec: prediction.delaySec ?? prediction.time - matched.time,
        source: "live",
        status: "normal",
        vehicleId: prediction.vehicleId,
      });
    } else {
      arrivals.push({
        stopId: matched.stopId,
        routeId: matched.routeId,
        directionId: matched.directionId,
        tripId: matched.tripId,
        headsign: matched.headsign,
        stopSequence: matched.stopSequence,
        time: matched.time,
        source: "live",
        status: prediction.status,
        vehicleId: prediction.vehicleId,
      });
    }
  }

  for (const row of scheduled) {
    if (matchedScheduledKeys.has(scheduledKey(row.tripId, row.serviceDate, row.stopId))) continue;
    arrivals.push({
      stopId: row.stopId,
      routeId: row.routeId,
      directionId: row.directionId,
      tripId: row.tripId,
      headsign: row.headsign,
      stopSequence: row.stopSequence,
      time: row.time,
      source: "scheduled",
      status: "normal",
    });
  }

  return { arrivals, unmatchedPredictions };
}

/**
 * Merges scheduled stop times with fresh realtime predictions for one stop (10.9).
 * Pure: the caller has already fetched scheduled rows and predictions for the window.
 */
export function mergeArrivals(
  scheduled: ScheduledStopTime[],
  predictions: StopTimePrediction[],
  now: EpochSeconds,
  settings: TransitSettings,
): Arrival[] {
  const { arrivals, unmatchedPredictions } = mergeScheduleWithPredictions(scheduled, predictions);

  for (const prediction of unmatchedPredictions) {
    if (prediction.status !== "normal") continue;
    arrivals.push({
      stopId: prediction.stopId,
      routeId: prediction.routeId,
      directionId: prediction.directionId,
      tripId: prediction.tripId,
      headsign: "",
      stopSequence: prediction.stopSequence,
      time: prediction.time,
      delaySec: prediction.delaySec,
      source: "live",
      status: prediction.status,
      vehicleId: prediction.vehicleId,
    });
  }

  const windowStart = now - settings.pastArrivalGraceSeconds;
  const windowEnd = now + settings.arrivalsWindowMinutes * 60;
  const inWindow = arrivals.filter((a) => a.time >= windowStart && a.time <= windowEnd);

  inWindow.sort(
    (a, b) =>
      a.time - b.time ||
      compareRoutesNaturally(a.routeId, b.routeId) ||
      (a.tripId < b.tripId ? -1 : a.tripId > b.tripId ? 1 : 0),
  );

  return inWindow;
}
