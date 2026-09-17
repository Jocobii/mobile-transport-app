import type { transit_realtime } from "gtfs-realtime-bindings";
import type {
  EpochSeconds,
  FeedId,
  ScheduledStopTime,
  ServiceDate,
  StopTimePrediction,
  Trip,
  TripId,
} from "@transit/core";
import { localServiceDate } from "../time/gtfs-time";
import type { TripLookup } from "./trip-lookup";

export interface NormalizeTripUpdatesOptions {
  feedId: FeedId;
  /** IANA time zone of the feed, used to fall back to today's service date. */
  timezone: string;
  tripLookup: TripLookup;
}

const SCHEDULE_RELATIONSHIP = {
  CANCELED: 3,
} as const;

const STOP_TIME_SCHEDULE_RELATIONSHIP = {
  SKIPPED: 1,
  NO_DATA: 2,
} as const;

/** GTFS-RT int64 fields decode as `number | string | Long`; all convert cleanly with `Number()`. */
function parseEpoch(value: unknown): EpochSeconds | undefined {
  if (value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function canceledPredictions(
  scheduled: ScheduledStopTime[],
  context: { feedId: FeedId; tripId: TripId; serviceDate: ServiceDate; vehicleId?: string },
): StopTimePrediction[] {
  return scheduled.map((stopTime) => ({
    feedId: context.feedId,
    tripId: context.tripId,
    serviceDate: context.serviceDate,
    routeId: stopTime.routeId,
    directionId: stopTime.directionId,
    stopId: stopTime.stopId,
    stopSequence: stopTime.stopSequence,
    time: 0,
    status: "canceled",
    vehicleId: context.vehicleId,
  }));
}

function normalizeStopTimeUpdate(
  update: transit_realtime.TripUpdate.IStopTimeUpdate,
  context: {
    feedId: FeedId;
    tripId: TripId;
    trip: Trip;
    serviceDate: ServiceDate | undefined;
    headerTimestamp: EpochSeconds | undefined;
    vehicleId: string | undefined;
    scheduledBySequence: Map<number, ScheduledStopTime>;
    scheduledByStopId: Map<string, ScheduledStopTime>;
  },
): StopTimePrediction | undefined {
  const { feedId, tripId, trip, serviceDate, headerTimestamp, vehicleId } = context;
  const relationship = update.scheduleRelationship ?? 0;

  if (relationship === STOP_TIME_SCHEDULE_RELATIONSHIP.NO_DATA) return undefined;

  const stopId =
    update.stopId || context.scheduledBySequence.get(update.stopSequence ?? -1)?.stopId;
  if (!stopId) return undefined;
  const stopSequence =
    update.stopSequence ?? context.scheduledByStopId.get(stopId)?.stopSequence;

  const base = {
    feedId,
    tripId,
    serviceDate,
    routeId: trip.routeId,
    directionId: trip.directionId,
    stopId,
    stopSequence,
    vehicleId,
  };

  if (relationship === STOP_TIME_SCHEDULE_RELATIONSHIP.SKIPPED) {
    return { ...base, time: 0, status: "skipped" };
  }

  const arrivalTime = parseEpoch(update.arrival?.time);
  const departureTime = parseEpoch(update.departure?.time);

  let time: EpochSeconds | undefined;
  let delaySec: number | undefined;
  if (arrivalTime !== undefined) {
    time = arrivalTime;
    delaySec = update.arrival?.delay ?? undefined;
  } else if (departureTime !== undefined) {
    time = departureTime;
    delaySec = update.departure?.delay ?? undefined;
  } else {
    const delay = update.arrival?.delay ?? update.departure?.delay;
    const scheduled =
      context.scheduledBySequence.get(update.stopSequence ?? -1) ??
      context.scheduledByStopId.get(stopId);
    if (scheduled && delay !== null && delay !== undefined) {
      time = scheduled.time + delay;
      delaySec = delay;
    }
  }
  if (time === undefined) return undefined;
  if (headerTimestamp !== undefined && time < headerTimestamp) return undefined;

  return { ...base, time, delaySec, status: "normal" };
}

/**
 * Normalizes a decoded TripUpdate `FeedMessage` into canonical `StopTimePrediction`s (10.7).
 * The catalog trip is authoritative for `routeId`/`directionId`; entities whose trip is not
 * in the catalog are skipped.
 */
export async function normalizeTripUpdates(
  feedMessage: transit_realtime.IFeedMessage,
  { feedId, timezone, tripLookup }: NormalizeTripUpdatesOptions,
): Promise<StopTimePrediction[]> {
  const headerTimestamp = parseEpoch(feedMessage.header?.timestamp);
  const entities = feedMessage.entity ?? [];

  const perEntity = await Promise.all(
    entities.map(async (entity): Promise<StopTimePrediction[]> => {
      const tripUpdate = entity.tripUpdate;
      const rawTripId = tripUpdate?.trip?.tripId;
      if (!tripUpdate || !rawTripId) return [];

      const tripId = `${feedId}:${rawTripId}`;
      const trip = await tripLookup.getTrip(tripId);
      if (!trip) return [];

      const vehicleId = tripUpdate.vehicle?.id ? `${feedId}:${tripUpdate.vehicle.id}` : undefined;
      const startDate = tripUpdate.trip?.startDate || undefined;
      const fallbackServiceDate =
        headerTimestamp !== undefined ? localServiceDate(headerTimestamp, timezone) : undefined;
      const effectiveServiceDate = startDate ?? fallbackServiceDate;

      if (tripUpdate.trip?.scheduleRelationship === SCHEDULE_RELATIONSHIP.CANCELED) {
        if (!effectiveServiceDate) return [];
        const scheduled = await tripLookup.getScheduledStopTimesForTrip(
          tripId,
          effectiveServiceDate,
        );
        return canceledPredictions(scheduled, {
          feedId,
          tripId,
          serviceDate: effectiveServiceDate,
          vehicleId,
        });
      }

      const scheduled = effectiveServiceDate
        ? await tripLookup.getScheduledStopTimesForTrip(tripId, effectiveServiceDate)
        : [];
      const scheduledBySequence = new Map(scheduled.map((s) => [s.stopSequence, s]));
      const scheduledByStopId = new Map(scheduled.map((s) => [s.stopId, s]));

      const updates = tripUpdate.stopTimeUpdate ?? [];
      const predictions: StopTimePrediction[] = [];
      for (const update of updates) {
        const prediction = normalizeStopTimeUpdate(update, {
          feedId,
          tripId,
          trip,
          serviceDate: startDate,
          headerTimestamp,
          vehicleId,
          scheduledBySequence,
          scheduledByStopId,
        });
        if (prediction) predictions.push(prediction);
      }
      return predictions;
    }),
  );

  return perEntity.flat();
}
