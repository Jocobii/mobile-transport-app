/**
 * Public API contract (v1). The server maps domain objects to these shapes;
 * the mobile app only depends on this package.
 * Endpoints are defined in the project decisions document.
 * All times are Unix epoch seconds.
 */

export const API_VERSION = "v1";

/** Header used to send the API key. */
export const API_KEY_HEADER = "x-api-key";

/** Stable error codes. Clients may branch on these; never rename a published code. */
export type ApiErrorCode =
  | "unauthorized"
  | "invalid_request"
  | "not_found"
  | "catalog_unavailable"
  | "server_misconfigured"
  | "internal_error";

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
  };
}

export interface LatLonDto {
  lat: number;
  lon: number;
}

export interface FeedStatusDto {
  feedId: string;
  ok: boolean;
  /** Unix epoch seconds reported by the feed. */
  dataTimestamp?: number | undefined;
  /** Unix epoch seconds when the server last fetched the feed. */
  fetchedAt?: number | undefined;
}

export interface RouteSummaryDto {
  id: string;
  feedId: string;
  shortName: string;
  longName: string;
  /** `#RRGGBB`, uppercase, or undefined. */
  color?: string | undefined;
  /** `#RRGGBB`, uppercase, or undefined. */
  textColor?: string | undefined;
}

export interface StopSummaryDto extends LatLonDto {
  id: string;
  code: string;
  name: string;
}

export interface ArrivalDto {
  tripId: string;
  routeId: string;
  routeShortName: string;
  /** `#RRGGBB`, uppercase, or undefined. */
  routeColor?: string | undefined;
  /** `#RRGGBB`, uppercase, or undefined. */
  routeTextColor?: string | undefined;
  directionId: 0 | 1;
  headsign: string;
  time: number;
  scheduledTime?: number | undefined;
  delaySec?: number | undefined;
  source: "live" | "scheduled";
  status: "normal" | "canceled" | "skipped";
  vehicleId?: string | undefined;
}

export interface VehicleDto extends LatLonDto {
  id: string;
  label?: string | undefined;
  routeId: string;
  routeShortName: string;
  /** `#RRGGBB`, uppercase, or undefined. */
  routeColor?: string | undefined;
  /** `#RRGGBB`, uppercase, or undefined. */
  routeTextColor?: string | undefined;
  directionId: 0 | 1;
  headsign: string;
  tripId: string;
  bearing?: number | undefined;
  updatedAt: number;
  occupancy?:
    | "empty"
    | "many_seats_available"
    | "few_seats_available"
    | "standing_room_only"
    | "crushed_standing_room_only"
    | "full"
    | "not_accepting_passengers"
    | "unknown"
    | undefined;
}

/** GET /api/v1/stops/nearby?lat=&lon=&radius= */
export interface NearbyStopDto {
  stop: StopSummaryDto;
  distanceMeters: number;
  routes: RouteSummaryDto[];
  nextArrivals: ArrivalDto[];
  approachingVehicles: VehicleDto[];
}
export interface NearbyStopsResponse {
  stops: NearbyStopDto[];
  /** true when no stop was inside the radius and the nearest stop was returned instead. */
  outsideRadius: boolean;
  feeds: FeedStatusDto[];
}

/** GET /api/v1/search?q= */
export interface SearchResponse {
  routes: RouteSummaryDto[];
  stops: StopSummaryDto[];
}

/** GET /api/v1/stops/{stopId}/arrivals */
export interface StopArrivalsResponse {
  stop: StopSummaryDto;
  routes: RouteSummaryDto[];
  arrivals: ArrivalDto[];
  feeds: FeedStatusDto[];
}

/** GET /api/v1/routes/{routeId}?directionId=&lat=&lon= */
export interface RouteDirectionDto {
  directionId: 0 | 1;
  headsign: string;
}
export interface RouteDetailResponse {
  route: RouteSummaryDto;
  directions: RouteDirectionDto[];
  selectedDirectionId: 0 | 1;
  /** Ordered, selected direction. */
  stops: StopSummaryDto[];
  /** Selected direction. */
  shape: LatLonDto[];
}

/** GET /api/v1/routes/{routeId}/vehicles?directionId= */
export interface RouteVehiclesResponse {
  routeId: string;
  vehicles: VehicleDto[];
  feeds: FeedStatusDto[];
}

/** GET /api/v1/vehicles/{vehicleId} */
export interface UpcomingStopDto {
  stop: StopSummaryDto;
  stopSequence: number;
  time: number;
  scheduledTime?: number | undefined;
  delaySec?: number | undefined;
  source: "live" | "scheduled";
  status: "normal" | "canceled" | "skipped";
}
export interface VehicleDetailResponse {
  vehicle: VehicleDto;
  route: RouteSummaryDto;
  upcomingStops: UpcomingStopDto[];
  feeds: FeedStatusDto[];
}

/** GET /api/v1/health */
export interface HealthResponse {
  status: "ok" | "degraded";
  /** Unix epoch seconds when the response was produced. */
  checkedAt: number;
  catalogVersion?: string | undefined;
  feeds: FeedStatusDto[];
}
