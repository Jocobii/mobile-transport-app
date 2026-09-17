import {
  addDays,
  approachingVehicles,
  isValidNormalizedQuery,
  localServiceDate,
  mergeArrivals,
  mergeScheduleWithPredictions,
  normalizeQuery,
  selectRoutePattern,
} from "./domain";
import type {
  Arrival,
  DirectionId,
  EpochSeconds,
  FeedConfig,
  FeedStatus,
  LatLon,
  Route,
  RouteId,
  ScheduledStopTime,
  Stop,
  StopId,
  StopTimePrediction,
  StopTimeStatus,
  StopWithDistance,
  Vehicle,
  VehicleId,
} from "./model";
import type { CatalogProvider, Clock, RealtimeProvider, RealtimeSnapshot } from "./ports";
import type { TransitSettings } from "./settings";

/**
 * Thrown by `getRouteDetail` when `directionId` is given but the route has no
 * pattern for it (10.12 rule 2).
 */
export class InvalidDirectionError extends Error {
  readonly routeId: RouteId;
  readonly directionId: DirectionId;

  constructor(routeId: RouteId, directionId: DirectionId) {
    super(`Route ${routeId} has no pattern for direction ${directionId}`);
    this.name = "InvalidDirectionError";
    this.routeId = routeId;
    this.directionId = directionId;
  }
}

export interface NearbyStopResult {
  stop: Stop;
  distanceMeters: number;
  routes: Route[];
  nextArrivals: Arrival[];
  approachingVehicles: Vehicle[];
}

export interface NearbyResult {
  stops: NearbyStopResult[];
  /** true when no stop was inside the radius and the nearest stop was returned instead. */
  outsideRadius: boolean;
  feeds: FeedStatus[];
}

export interface SearchResult {
  routes: Route[];
  stops: Stop[];
}

export interface StopArrivalsResult {
  stop: Stop;
  routes: Route[];
  arrivals: Arrival[];
  feeds: FeedStatus[];
}

export interface RouteDirection {
  directionId: DirectionId;
  headsign: string;
}

export interface RouteDetailResult {
  route: Route;
  directions: RouteDirection[];
  selectedDirectionId: DirectionId;
  stops: Stop[];
  shape: LatLon[];
}

export interface RouteVehiclesResult {
  routeId: RouteId;
  /** The route itself, so callers can resolve each vehicle's route short name and color. */
  route: Route;
  vehicles: Vehicle[];
  feeds: FeedStatus[];
}

export interface UpcomingStopResult {
  stop: Stop;
  stopSequence: number;
  time: EpochSeconds;
  scheduledTime?: EpochSeconds;
  delaySec?: number;
  source: "live" | "scheduled";
  status: StopTimeStatus;
}

export interface VehicleDetailResult {
  vehicle: Vehicle;
  route: Route;
  upcomingStops: UpcomingStopResult[];
  feeds: FeedStatus[];
}

export interface HealthResult {
  status: "ok" | "degraded";
  checkedAt: EpochSeconds;
  catalogVersion?: string;
  feeds: FeedStatus[];
}

export interface TransitServiceDeps {
  catalog: CatalogProvider;
  realtime: RealtimeProvider[];
  clock: Clock;
  settings: TransitSettings;
  /** Feed configuration, used only to resolve each feed's IANA time zone for 10.14 rule 2. */
  feeds: FeedConfig[];
}

interface CombinedRealtime {
  vehicles: Vehicle[];
  predictions: StopTimePrediction[];
  feeds: FeedStatus[];
}

export function createTransitService(deps: TransitServiceDeps) {
  const { catalog, realtime, clock, settings, feeds: feedConfigs } = deps;
  const timezoneByFeedId = new Map(feedConfigs.map((feed) => [feed.id, feed.timezone]));

  /**
   * Fetches every provider's snapshot in parallel (providers never throw) and combines
   * them into one set of vehicles, predictions and feed statuses. Callers that need
   * realtime data fetch it exactly once per use-case call and reuse it (10.11).
   */
  async function fetchRealtime(): Promise<CombinedRealtime> {
    const snapshots: RealtimeSnapshot[] = await Promise.all(
      realtime.map((provider) => provider.getSnapshot()),
    );

    const vehicles: Vehicle[] = [];
    const predictions: StopTimePrediction[] = [];
    const feeds: FeedStatus[] = [];
    for (const snapshot of snapshots) {
      vehicles.push(...snapshot.vehicles);
      predictions.push(...snapshot.predictions);
      feeds.push(snapshot.status);
    }
    return { vehicles, predictions, feeds };
  }

  async function arrivalsForStop(
    stopId: StopId,
    predictions: StopTimePrediction[],
    now: EpochSeconds,
  ): Promise<Arrival[]> {
    const from = now - settings.pastArrivalGraceSeconds;
    const to = now + settings.arrivalsWindowMinutes * 60;
    const scheduled = await catalog.getScheduledStopTimesAtStop(stopId, from, to);
    const stopPredictions = predictions.filter((prediction) => prediction.stopId === stopId);
    return mergeArrivals(scheduled, stopPredictions, now, settings);
  }

  async function getNearby(center: LatLon, radiusMeters: number): Promise<NearbyResult> {
    const [nearStops, combined] = await Promise.all([
      catalog.findStopsNear(center, radiusMeters, settings.nearbyMaxStops),
      fetchRealtime(),
    ]);

    let stopsWithDistance: StopWithDistance[] = nearStops;
    let outsideRadius = false;
    if (stopsWithDistance.length === 0) {
      const nearest = await catalog.findNearestStop(
        center,
        settings.nearbyFallbackMaxDistanceMeters,
      );
      if (nearest) {
        stopsWithDistance = [nearest];
        outsideRadius = true;
      }
    }

    const now = clock.now();
    const stops = await Promise.all(
      stopsWithDistance.map(async ({ stop, distanceMeters }): Promise<NearbyStopResult> => {
        const [routes, arrivals] = await Promise.all([
          catalog.getRoutesServingStop(stop.id),
          arrivalsForStop(stop.id, combined.predictions, now),
        ]);
        const nextArrivals = arrivals.slice(0, settings.nearbyArrivalsPerStop);
        return {
          stop,
          distanceMeters,
          routes,
          nextArrivals,
          approachingVehicles: approachingVehicles(nextArrivals, combined.vehicles, now),
        };
      }),
    );

    return { stops, outsideRadius, feeds: combined.feeds };
  }

  async function search(rawQuery: string): Promise<SearchResult> {
    const normalized = normalizeQuery(rawQuery);
    if (!isValidNormalizedQuery(normalized)) return { routes: [], stops: [] };

    const [routes, stops] = await Promise.all([
      catalog.searchRoutes(normalized, settings.searchMaxRoutes),
      catalog.searchStops(normalized, settings.searchMaxStops),
    ]);
    return { routes, stops };
  }

  async function getStopArrivals(stopId: StopId): Promise<StopArrivalsResult | undefined> {
    const stop = await catalog.getStop(stopId);
    if (!stop) return undefined;

    const [routes, combined] = await Promise.all([
      catalog.getRoutesServingStop(stopId),
      fetchRealtime(),
    ]);

    const now = clock.now();
    const arrivals = await arrivalsForStop(stopId, combined.predictions, now);
    return {
      stop,
      routes,
      arrivals: arrivals.slice(0, settings.stopArrivalsLimit),
      feeds: combined.feeds,
    };
  }

  async function getRouteDetail(
    routeId: RouteId,
    options: { directionId?: DirectionId; near?: LatLon },
  ): Promise<RouteDetailResult | undefined> {
    const route = await catalog.getRoute(routeId);
    if (!route) return undefined;

    const patterns = await catalog.getRoutePatterns(routeId);
    const selection = selectRoutePattern(patterns, options);
    if (!selection.ok) {
      if (selection.reason === "not_found") return undefined;
      throw new InvalidDirectionError(routeId, options.directionId as DirectionId);
    }

    const directions = [...patterns]
      .sort((a, b) => a.directionId - b.directionId)
      .map((pattern) => ({ directionId: pattern.directionId, headsign: pattern.headsign }));

    return {
      route,
      directions,
      selectedDirectionId: selection.pattern.directionId,
      stops: selection.pattern.stops,
      shape: selection.pattern.shape,
    };
  }

  async function getRouteVehicles(
    routeId: RouteId,
    directionId?: DirectionId,
  ): Promise<RouteVehiclesResult | undefined> {
    const route = await catalog.getRoute(routeId);
    if (!route) return undefined;

    const combined = await fetchRealtime();
    const vehicles = combined.vehicles
      .filter(
        (vehicle) =>
          vehicle.routeId === routeId &&
          (directionId === undefined || vehicle.directionId === directionId),
      )
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

    return { routeId, route, vehicles, feeds: combined.feeds };
  }

  /** Scheduled stop times for the vehicle's trip on the service date determined by 10.14 rule 2. */
  async function scheduledStopTimesForTrip(
    tripId: string,
    feedId: string,
    predictedServiceDate: string | undefined,
    now: EpochSeconds,
  ): Promise<ScheduledStopTime[]> {
    if (predictedServiceDate !== undefined) {
      return catalog.getScheduledStopTimesForTrip(tripId, predictedServiceDate);
    }

    const timezone = timezoneByFeedId.get(feedId) ?? "UTC";
    const today = localServiceDate(now, timezone);
    const rows = await catalog.getScheduledStopTimesForTrip(tripId, today);
    if (rows.length > 0) return rows;

    return catalog.getScheduledStopTimesForTrip(tripId, addDays(today, -1));
  }

  async function getVehicleDetail(vehicleId: VehicleId): Promise<VehicleDetailResult | undefined> {
    const combined = await fetchRealtime();
    const now = clock.now();
    const vehicle = combined.vehicles.find((candidate) => candidate.id === vehicleId);
    if (!vehicle) return undefined;

    const route = await catalog.getRoute(vehicle.routeId);
    if (!route) return undefined;

    const trip = await catalog.getTrip(vehicle.tripId);
    const tripPredictions = combined.predictions.filter(
      (prediction) => prediction.tripId === vehicle.tripId,
    );
    const predictedServiceDate = tripPredictions.find(
      (prediction) => prediction.serviceDate !== undefined,
    )?.serviceDate;

    const rows = trip
      ? await scheduledStopTimesForTrip(trip.id, vehicle.feedId, predictedServiceDate, now)
      : [];

    const currentSequence = vehicle.currentStopSequence;
    const upcomingScheduled = rows
      .filter((row) =>
        currentSequence === undefined
          ? row.time >= now - settings.pastArrivalGraceSeconds
          : row.stopSequence >= currentSequence,
      )
      .sort((a, b) => a.stopSequence - b.stopSequence);

    const { arrivals } = mergeScheduleWithPredictions(upcomingScheduled, tripPredictions);
    const arrivalsByStopId = new Map(arrivals.map((arrival) => [arrival.stopId, arrival]));

    const upcomingStops: UpcomingStopResult[] = [];
    for (const row of upcomingScheduled) {
      const stop = await catalog.getStop(row.stopId);
      if (!stop) continue;
      const arrival = arrivalsByStopId.get(row.stopId);
      upcomingStops.push({
        stop,
        stopSequence: row.stopSequence,
        time: arrival?.time ?? row.time,
        scheduledTime: arrival?.scheduledTime,
        delaySec: arrival?.delaySec,
        source: arrival?.source ?? "scheduled",
        status: arrival?.status ?? "normal",
      });
    }

    return { vehicle, route, upcomingStops, feeds: combined.feeds };
  }

  async function getHealth(): Promise<HealthResult> {
    const now = clock.now();
    const [catalogVersion, snapshots] = await Promise.all([
      catalog.getCatalogVersion().catch(() => undefined),
      Promise.all(realtime.map((provider) => provider.getSnapshot())),
    ]);

    const feeds = snapshots.map((snapshot) => snapshot.status);
    const status: "ok" | "degraded" =
      catalogVersion !== undefined && feeds.every((feed) => feed.ok) ? "ok" : "degraded";

    return { status, checkedAt: now, catalogVersion, feeds };
  }

  return {
    getNearby,
    search,
    getStopArrivals,
    getRouteDetail,
    getRouteVehicles,
    getVehicleDetail,
    getHealth,
  };
}

export type TransitService = ReturnType<typeof createTransitService>;
