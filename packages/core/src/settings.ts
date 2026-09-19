/**
 * Named constants that shape `TransitService` and the adapters' behavior.
 * Concrete values live in `apps/server/src/config/transit-settings.ts`
 * (section 6.2 of EPIC-001). Never hard-code these values anywhere else.
 */
export interface TransitSettings {
  /** Realtime providers: how long a feed snapshot is cached. */
  realtimeCacheTtlSeconds: number;
  /** Vehicle positions and predictions older than this are treated as stale. */
  realtimeStaleAfterSeconds: number;
  /** Timeout for realtime feed downloads. */
  feedFetchTimeoutMs: number;

  /**
   * `stops/nearby` radius steps (meters) tried in order when `radius` is omitted; the first step
   * that finds at least `nearbyMinStops` stops is used. The first step is the default radius.
   */
  nearbyRadiusStepsMeters: number[];
  /** Minimum stop count that stops the adaptive radius from growing further. */
  nearbyMinStops: number;
  /** Validation bounds for the `radius` query parameter. */
  nearbyMinRadiusMeters: number;
  nearbyMaxRadiusMeters: number;
  /** Max stops returned by `stops/nearby`. */
  nearbyMaxStops: number;
  /** Max distance used to find the nearest stop when none is inside the radius. */
  nearbyFallbackMaxDistanceMeters: number;
  /** Arrivals returned per stop in `stops/nearby`. */
  nearbyArrivalsPerStop: number;

  /** Validation bound for `stops/in-area`'s `bbox` span (degrees, per axis). */
  areaStopsMaxSpanDegrees: number;
  /** Max stops returned by `stops/in-area`. */
  areaStopsMaxResults: number;
  /** Validation bound for `vehicles/in-area`'s `bbox` span (degrees, per axis). */
  areaVehiclesMaxSpanDegrees: number;
  /** Max vehicles returned by `vehicles/in-area`. */
  areaVehiclesMaxResults: number;

  /** Lookahead window for nearby and stop arrivals. */
  arrivalsWindowMinutes: number;
  /** Max arrivals returned by `stops/{stopId}/arrivals`. */
  stopArrivalsLimit: number;
  /** Arrivals up to this many seconds in the past are still returned. */
  pastArrivalGraceSeconds: number;

  /** Max results returned by `search`. */
  searchMaxRoutes: number;
  searchMaxStops: number;
  /** Validation bound for the `q` query parameter. */
  searchMaxQueryLength: number;

  /** Service dates materialized at catalog build time, relative to the build date. */
  catalogServiceDaysBefore: number;
  catalogServiceDaysAfter: number;
  /** Lookahead window used to pick the representative pattern per route/direction. */
  patternLookaheadDays: number;
  /** Douglas-Peucker tolerance used to simplify route shapes. */
  shapeSimplifyToleranceMeters: number;

  /** Sent as `User-Agent` on every outgoing request (GTFS static and realtime). */
  httpUserAgent: string;
}
