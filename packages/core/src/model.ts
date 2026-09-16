/**
 * Canonical transit model.
 *
 * Every data source (GTFS, GTFS-Realtime, future providers) is translated into
 * these types. Nothing outside the adapters knows where the data came from.
 */

/** Global ids are prefixed with the agency id, e.g. `mvta:436`. Stops use the regional stop_id. */
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

export interface Agency {
  id: AgencyId;
  name: string;
}

export interface Route {
  id: RouteId;
  agencyId: AgencyId;
  /** Can be empty for some routes (e.g. rail lines); search must also use `longName`. */
  shortName: string;
  longName: string;
  /** Hex color without `#`, when the feed provides one. */
  color?: string;
  textColor?: string;
}

export interface Direction {
  routeId: RouteId;
  directionId: DirectionId;
  headsign: string;
}

export interface Stop extends LatLon {
  id: StopId;
  /** Number printed on the stop sign. */
  code: string;
  name: string;
  /** A stop shared by several agencies keeps a single entry. */
  agencyIds: AgencyId[];
}

export interface Shape {
  routeId: RouteId;
  directionId: DirectionId;
  points: LatLon[];
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
  label?: string;
  routeId: RouteId;
  directionId: DirectionId;
  tripId: TripId;
  bearing?: number;
  /** When the position was reported by the vehicle. */
  updatedAt: EpochSeconds;
  occupancy?: OccupancyStatus;
}

export type ArrivalSource = "live" | "scheduled";
export type ArrivalStatus = "normal" | "canceled" | "skipped";

export interface Arrival {
  stopId: StopId;
  routeId: RouteId;
  directionId: DirectionId;
  tripId: TripId;
  headsign: string;
  /** Best known time: prediction when live, schedule otherwise. */
  time: EpochSeconds;
  scheduledTime?: EpochSeconds;
  delaySec?: number;
  source: ArrivalSource;
  status: ArrivalStatus;
  vehicleId?: VehicleId;
}

export interface Alert {
  id: string;
  routeIds: RouteId[];
  stopIds: StopId[];
  header: string;
  description?: string;
  activeFrom?: EpochSeconds;
  activeUntil?: EpochSeconds;
}

/** Metadata attached to every realtime result. */
export interface Freshness {
  providerId: string;
  /** Timestamp reported by the source feed. */
  dataTimestamp: EpochSeconds;
  /** When the server fetched the source. */
  fetchedAt: EpochSeconds;
}
