/**
 * Canonical transit model.
 *
 * Every data source (GTFS, GTFS-Realtime, future providers) is translated into
 * these types. Nothing outside the adapters knows where the data came from.
 */

export type FeedId = string;
/** YYYYMMDD in the feed time zone. */
export type ServiceDate = string;

/** Global ids are prefixed with the feed id, e.g. `mvta:436`. Stops use the regional stop_id. */
export type AgencyId = string;
export type RouteId = string;
export type StopId = string;
export type TripId = string;
export type VehicleId = string;

/** GTFS direction_id. */
export type DirectionId = 0 | 1;

/** Unix epoch in seconds. */
export type EpochSeconds = number;

export interface LatLon {
  lat: number;
  lon: number;
}

export interface FeedConfig {
  id: FeedId;
  name: string;
  /** IANA time zone, e.g. "America/Chicago". */
  timezone: string;
  staticUrl: string;
  vehiclePositionsUrl: string;
  tripUpdatesUrl: string;
}

export interface Agency {
  id: AgencyId;
  feedId: FeedId;
  name: string;
}

export interface Route {
  id: RouteId;
  feedId: FeedId;
  agencyId: AgencyId;
  /** Can be empty for some routes (e.g. rail lines); search must also use `longName`. */
  shortName: string;
  longName: string;
  /** Hex color without `#`, when the feed provides one. */
  color?: string | undefined;
  textColor?: string | undefined;
  sortOrder?: number | undefined;
}

export interface Stop extends LatLon {
  id: StopId;
  /** Number printed on the stop sign, falls back to `stop_id`. */
  code: string;
  name: string;
  /** A stop shared by several agencies keeps a single entry. Replaces `agencyIds`. */
  feedIds: FeedId[];
}

export interface StopWithDistance {
  stop: Stop;
  distanceMeters: number;
}

export interface Trip {
  id: TripId;
  feedId: FeedId;
  routeId: RouteId;
  directionId: DirectionId;
  headsign: string;
  patternId: string;
}

export interface ScheduledStopTime {
  tripId: TripId;
  routeId: RouteId;
  directionId: DirectionId;
  headsign: string;
  stopId: StopId;
  stopSequence: number;
  serviceDate: ServiceDate;
  /** Departure time, falls back to arrival time. */
  time: EpochSeconds;
}

export interface RoutePattern {
  /** `${routeId}:${directionId}`. */
  id: string;
  routeId: RouteId;
  directionId: DirectionId;
  headsign: string;
  /** Ordered. */
  stops: Stop[];
  /** Simplified polyline. */
  shape: LatLon[];
}

export type StopTimeStatus = "normal" | "canceled" | "skipped";

/** One normalized GTFS-RT stop time update (future stops only). */
export interface StopTimePrediction {
  feedId: FeedId;
  tripId: TripId;
  /** From `trip.start_date`, when present. */
  serviceDate?: ServiceDate | undefined;
  routeId: RouteId;
  directionId: DirectionId;
  stopId: StopId;
  stopSequence?: number | undefined;
  /** For status "normal"; for canceled/skipped, 0 means "use schedule". */
  time: EpochSeconds;
  delaySec?: number | undefined;
  status: StopTimeStatus;
  vehicleId?: VehicleId | undefined;
}

export type OccupancyStatus =
  | "empty"
  | "many_seats_available"
  | "few_seats_available"
  | "standing_room_only"
  | "crushed_standing_room_only"
  | "full"
  | "not_accepting_passengers"
  | "unknown";

export interface Vehicle extends LatLon {
  id: VehicleId;
  feedId: FeedId;
  label?: string | undefined;
  routeId: RouteId;
  directionId: DirectionId;
  tripId: TripId;
  /** Destination of the vehicle's trip, from the catalog. Empty only when the trip has no headsign. */
  headsign: string;
  bearing?: number | undefined;
  currentStopSequence?: number | undefined;
  /** When the position was reported by the vehicle. */
  updatedAt: EpochSeconds;
  occupancy?: OccupancyStatus | undefined;
}

/** @deprecated Use `Arrival["source"]` directly. */
export type ArrivalSource = "live" | "scheduled";
/** @deprecated Use `StopTimeStatus`. */
export type ArrivalStatus = StopTimeStatus;

export interface Arrival {
  stopId: StopId;
  routeId: RouteId;
  directionId: DirectionId;
  tripId: TripId;
  headsign: string;
  /** From the matched scheduled row. */
  stopSequence?: number | undefined;
  /** Best known time: prediction when live, schedule otherwise. */
  time: EpochSeconds;
  scheduledTime?: EpochSeconds | undefined;
  delaySec?: number | undefined;
  source: ArrivalSource;
  status: StopTimeStatus;
  vehicleId?: VehicleId | undefined;
}

export interface Alert {
  id: string;
  routeIds: RouteId[];
  stopIds: StopId[];
  header: string;
  description?: string | undefined;
  activeFrom?: EpochSeconds | undefined;
  activeUntil?: EpochSeconds | undefined;
}

/** Freshness/health of one feed's realtime data. Replaces `Freshness`. */
export interface FeedStatus {
  feedId: FeedId;
  /** Fetched successfully and not stale. */
  ok: boolean;
  /** Feed header timestamp. */
  dataTimestamp?: EpochSeconds | undefined;
  fetchedAt?: EpochSeconds | undefined;
}
