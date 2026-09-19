import type { Bounds, LatLon } from "../model";

/** Whether `point` lies inside `bounds` (inclusive of the edges). */
export function boundsContain(bounds: Bounds, point: LatLon): boolean {
  return (
    point.lat >= bounds.minLat &&
    point.lat <= bounds.maxLat &&
    point.lon >= bounds.minLon &&
    point.lon <= bounds.maxLon
  );
}

/** Geometric center of a bounding box (midpoint of each axis; good enough at this scale). */
export function boundsCenter(bounds: Bounds): LatLon {
  return {
    lat: (bounds.minLat + bounds.maxLat) / 2,
    lon: (bounds.minLon + bounds.maxLon) / 2,
  };
}

/** Width and height of a bounding box, in degrees. */
export function boundsSpan(bounds: Bounds): { latSpan: number; lonSpan: number } {
  return {
    latSpan: bounds.maxLat - bounds.minLat,
    lonSpan: bounds.maxLon - bounds.minLon,
  };
}
