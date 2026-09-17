import type { ScheduledStopTime, ServiceDate, Trip, TripId } from "@transit/core";

/**
 * The subset of `CatalogProvider` that GTFS-RT normalization needs. The catalog is
 * authoritative: `routeId`/`directionId`/`headsign` always come from here, never the feed.
 */
export interface TripLookup {
  getTrip(tripId: TripId): Promise<Trip | undefined>;
  getScheduledStopTimesForTrip(
    tripId: TripId,
    serviceDate: ServiceDate,
  ): Promise<ScheduledStopTime[]>;
}
