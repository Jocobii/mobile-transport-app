import type {
  Bounds,
  EpochSeconds,
  FeedId,
  FeedStatus,
  LatLon,
  Route,
  RouteId,
  RoutePattern,
  ScheduledStopTime,
  ServiceDate,
  Stop,
  StopId,
  StopTimePrediction,
  StopWithDistance,
  Trip,
  TripId,
  Vehicle,
} from "./model";

/**
 * Ports implemented by adapters. The domain depends on these interfaces only;
 * adapters (GTFS, GTFS-Realtime, ...) live in other packages.
 */

export interface ProviderCapabilities {
  hasVehicles: boolean;
  hasPredictions: boolean;
  hasAlerts: boolean;
  /** Whether trip/stop ids match the agency catalog. */
  idsMatchCatalog: boolean;
}

/** Static data: agencies, routes, stops, shapes and schedules. */
export interface CatalogProvider {
  getCatalogVersion(): Promise<string>;
  getStop(stopId: StopId): Promise<Stop | undefined>;
  findStopsNear(center: LatLon, radiusMeters: number, limit: number): Promise<StopWithDistance[]>;
  findNearestStop(center: LatLon, maxDistanceMeters: number): Promise<StopWithDistance | undefined>;
  /** Every stop inside `bounds`, ordered by distance to its center, capped at `limit`. */
  findStopsInBounds(bounds: Bounds, limit: number): Promise<{ stops: Stop[]; truncated: boolean }>;
  searchRoutes(normalizedQuery: string, limit: number): Promise<Route[]>;
  searchStops(normalizedQuery: string, limit: number): Promise<Stop[]>;
  getRoute(routeId: RouteId): Promise<Route | undefined>;
  getRoutesServingStop(stopId: StopId): Promise<Route[]>;
  getRoutePatterns(routeId: RouteId): Promise<RoutePattern[]>;
  getTrip(tripId: TripId): Promise<Trip | undefined>;
  getScheduledStopTimesAtStop(
    stopId: StopId,
    from: EpochSeconds,
    to: EpochSeconds,
  ): Promise<ScheduledStopTime[]>;
  getScheduledStopTimesForTrip(
    tripId: TripId,
    serviceDate: ServiceDate,
  ): Promise<ScheduledStopTime[]>;
  /**
   * Every scheduled departure at `stopId` whose trip runs on `serviceDate`, ascending by time.
   * Trips that end at the stop are excluded (nobody boards there). Times may fall on the
   * next calendar day (GTFS times past 24:00).
   */
  getScheduledStopTimesForServiceDate(
    stopId: StopId,
    serviceDate: ServiceDate,
  ): Promise<ScheduledStopTime[]>;
  /** Distinct service dates covered by the catalog, ascending. */
  getServiceDates(): Promise<ServiceDate[]>;
}

export interface RealtimeSnapshot {
  feedId: FeedId;
  vehicles: Vehicle[];
  predictions: StopTimePrediction[];
  status: FeedStatus;
}

/** Live data for one feed. */
export interface RealtimeProvider {
  readonly feedId: FeedId;
  readonly capabilities: ProviderCapabilities;
  /** Never throws: failures are reported through `status.ok = false` with empty data. */
  getSnapshot(): Promise<RealtimeSnapshot>;
}

/** Source of current time. Domain code never calls `Date.now()` directly. */
export interface Clock {
  /** Current Unix epoch in seconds. */
  now(): EpochSeconds;
}

/** Key-value cache with expiration. Implementations are injected (in-memory, Redis, fakes). */
export interface Cache {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
}
