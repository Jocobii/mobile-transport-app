import type { UpcomingStopDto } from "@transit/contracts";
import { distanceMeters, type Position } from "@/shared/geo/position";

function nearestIndex(shape: Position[], point: Position): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  shape.forEach((candidate, index) => {
    const distance = distanceMeters(candidate, point);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

/**
 * Slice of the route shape from the point nearest the bus to the point nearest the stop, in
 * travel order. Returns `[bus, stop]` when the shape is empty or the stop is not ahead of the bus.
 */
export function segmentToStop(shape: Position[], bus: Position, stop: Position): Position[] {
  if (shape.length === 0) return [bus, stop];
  const busIndex = nearestIndex(shape, bus);
  const stopIndex = nearestIndex(shape, stop);
  if (stopIndex <= busIndex) return [bus, stop];
  return shape.slice(busIndex, stopIndex + 1);
}

/** Straight segments through the upcoming stops up to (and including) the target index. */
export function fallbackSegment(
  bus: Position,
  upcomingStops: UpcomingStopDto[],
  targetIndex: number,
): Position[] {
  return [bus, ...upcomingStops.slice(0, targetIndex + 1).map((upcoming) => upcoming.stop)];
}
