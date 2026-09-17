import type { Arrival, EpochSeconds, Vehicle } from "../model";

/**
 * Vehicles approaching a stop (10.10, initial state / option A): a fresh vehicle is
 * approaching when one of the stop's merged arrivals is its trip's normal, upcoming
 * arrival, and (its current stop sequence is unknown, or that arrival's stop sequence
 * is at or ahead of it). Vehicles are ordered like the arrivals they match; a vehicle
 * appears at most once.
 */
export function approachingVehicles(
  arrivals: Arrival[],
  vehicles: Vehicle[],
  now: EpochSeconds,
): Vehicle[] {
  const vehiclesByTripId = new Map<string, Vehicle>();
  for (const vehicle of vehicles) vehiclesByTripId.set(vehicle.tripId, vehicle);

  const seen = new Set<string>();
  const result: Vehicle[] = [];

  for (const arrival of arrivals) {
    if (arrival.status !== "normal" || arrival.time < now) continue;

    const vehicle = vehiclesByTripId.get(arrival.tripId);
    if (!vehicle || seen.has(vehicle.id)) continue;

    const currentSequence = vehicle.currentStopSequence;
    const arrivalSequence = arrival.stopSequence;
    const isAhead =
      currentSequence === undefined ||
      arrivalSequence === undefined ||
      arrivalSequence >= currentSequence;
    if (!isAhead) continue;

    seen.add(vehicle.id);
    result.push(vehicle);
  }

  return result;
}
