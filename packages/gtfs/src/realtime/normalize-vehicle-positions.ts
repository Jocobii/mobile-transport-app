import type { EpochSeconds, FeedId, OccupancyStatus, Vehicle } from "@transit/core";
import type { transit_realtime } from "gtfs-realtime-bindings";
import type { TripLookup } from "./trip-lookup";

export interface NormalizeVehiclePositionsOptions {
  feedId: FeedId;
  tripLookup: TripLookup;
}

const OCCUPANCY_STATUS_NAMES: Record<number, OccupancyStatus> = {
  0: "empty",
  1: "many_seats_available",
  2: "few_seats_available",
  3: "standing_room_only",
  4: "crushed_standing_room_only",
  5: "full",
  6: "not_accepting_passengers",
};

function occupancyStatusOf(raw: number | null | undefined): OccupancyStatus | undefined {
  if (raw === null || raw === undefined) return undefined;
  return OCCUPANCY_STATUS_NAMES[raw] ?? "unknown";
}

/** GTFS-RT int64 fields decode as `number | string | Long`; all convert cleanly with `Number()`. */
function parseEpoch(value: unknown): EpochSeconds | undefined {
  if (value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Normalizes a decoded VehiclePosition `FeedMessage` into canonical `Vehicle`s (10.7).
 * The catalog trip is authoritative for `routeId`/`directionId`/`headsign`; entities whose trip is
 * not in the catalog, or that have no usable position, are skipped.
 */
export async function normalizeVehiclePositions(
  feedMessage: transit_realtime.IFeedMessage,
  { feedId, tripLookup }: NormalizeVehiclePositionsOptions,
): Promise<Vehicle[]> {
  const headerTimestamp = parseEpoch(feedMessage.header?.timestamp);
  const entities = feedMessage.entity ?? [];

  const candidates = await Promise.all(
    entities.map(async (entity): Promise<Vehicle | undefined> => {
      const vehicle = entity.vehicle;
      const rawTripId = vehicle?.trip?.tripId;
      if (!vehicle || !rawTripId) return undefined;

      const position = vehicle.position;
      const lat = position?.latitude ?? 0;
      const lon = position?.longitude ?? 0;
      if (!position || (lat === 0 && lon === 0)) return undefined;

      const tripId = `${feedId}:${rawTripId}`;
      const trip = await tripLookup.getTrip(tripId);
      if (!trip) return undefined;

      const rawVehicleId = vehicle.vehicle?.id?.trim() || vehicle.vehicle?.label?.trim();
      if (!rawVehicleId) return undefined;

      const updatedAt = parseEpoch(vehicle.timestamp) ?? headerTimestamp;
      if (updatedAt === undefined) return undefined;

      return {
        id: `${feedId}:${rawVehicleId}`,
        feedId,
        lat,
        lon,
        label: vehicle.vehicle?.label || undefined,
        routeId: trip.routeId,
        directionId: trip.directionId,
        tripId,
        headsign: trip.headsign,
        bearing: position.bearing ?? undefined,
        currentStopSequence: vehicle.currentStopSequence ?? undefined,
        updatedAt,
        occupancy: occupancyStatusOf(vehicle.occupancyStatus),
      };
    }),
  );

  const byId = new Map<string, Vehicle>();
  for (const vehicle of candidates) {
    if (!vehicle) continue;
    const existing = byId.get(vehicle.id);
    if (!existing || vehicle.updatedAt >= existing.updatedAt) byId.set(vehicle.id, vehicle);
  }

  return [...byId.values()];
}
