import type { TransitSettings } from "@transit/core";

/**
 * Named constants that shape TransitService and the adapters' behavior (EPIC-001 6.2).
 * Never hard-code these values anywhere else.
 */
export const TRANSIT_SETTINGS: TransitSettings = {
  realtimeCacheTtlSeconds: 20,
  realtimeStaleAfterSeconds: 120,
  feedFetchTimeoutMs: 8000,

  nearbyDefaultRadiusMeters: 500,
  nearbyMinRadiusMeters: 50,
  nearbyMaxRadiusMeters: 2000,
  nearbyMaxStops: 10,
  nearbyFallbackMaxDistanceMeters: 5000,
  nearbyArrivalsPerStop: 3,

  arrivalsWindowMinutes: 90,
  stopArrivalsLimit: 30,
  pastArrivalGraceSeconds: 60,

  searchMaxRoutes: 10,
  searchMaxStops: 20,
  searchMaxQueryLength: 50,

  catalogServiceDaysBefore: 1,
  catalogServiceDaysAfter: 13,
  patternLookaheadDays: 7,
  shapeSimplifyToleranceMeters: 5,

  httpUserAgent: "transit-app/0.1 (personal use)",
};
