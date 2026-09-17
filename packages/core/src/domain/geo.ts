import type { LatLon } from "../model";

const EARTH_RADIUS_METERS = 6_371_000;
const METERS_PER_DEGREE_LAT = 111_320;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance between two points, in meters. */
export function haversineMeters(a: LatLon, b: LatLon): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

/**
 * A rectangular prefilter around `center`, generous enough to contain every point within
 * `radiusMeters` (used to narrow SQL candidates before an exact haversine filter).
 */
export function boundingBox(center: LatLon, radiusMeters: number): BoundingBox {
  const latDeltaDeg = radiusMeters / METERS_PER_DEGREE_LAT;
  const cosLat = Math.max(Math.cos(toRadians(center.lat)), 0.01);
  const lonDeltaDeg = radiusMeters / (METERS_PER_DEGREE_LAT * cosLat);
  return {
    minLat: center.lat - latDeltaDeg,
    maxLat: center.lat + latDeltaDeg,
    minLon: center.lon - lonDeltaDeg,
    maxLon: center.lon + lonDeltaDeg,
  };
}
