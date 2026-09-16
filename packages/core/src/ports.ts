import type {
  Agency,
  Alert,
  Arrival,
  Direction,
  DirectionId,
  EpochSeconds,
  Freshness,
  LatLon,
  Route,
  RouteId,
  Shape,
  Stop,
  StopId,
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
  getAgencies(): Promise<Agency[]>;
  getRoutes(): Promise<Route[]>;
  getDirections(routeId: RouteId): Promise<Direction[]>;
  getStop(stopId: StopId): Promise<Stop | undefined>;
  findStopsNear(location: LatLon, radiusMeters: number): Promise<Stop[]>;
  getRouteStops(routeId: RouteId, directionId: DirectionId): Promise<Stop[]>;
  getShape(routeId: RouteId, directionId: DirectionId): Promise<Shape | undefined>;
  getScheduledArrivals(stopId: StopId, from: number, to: number): Promise<Arrival[]>;
}

export interface RealtimeSnapshot {
  vehicles: Vehicle[];
  arrivals: Arrival[];
  alerts: Alert[];
  freshness: Freshness;
}

/** Live data for one agency. */
export interface RealtimeProvider {
  readonly id: string;
  readonly capabilities: ProviderCapabilities;
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
