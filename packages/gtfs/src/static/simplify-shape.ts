import type { LatLon } from "@transit/core";

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Perpendicular distance from `point` to the segment `start`–`end`, in meters
 * (equirectangular approximation, fine at simplification scale).
 */
function perpendicularDistanceMeters(point: LatLon, start: LatLon, end: LatLon): number {
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLon = 111320 * Math.cos(toRadians(start.lat));

  const toXY = (p: LatLon): { x: number; y: number } => ({
    x: p.lon * metersPerDegreeLon,
    y: p.lat * metersPerDegreeLat,
  });

  const p = toXY(point);
  const s = toXY(start);
  const e = toXY(end);

  const dx = e.x - s.x;
  const dy = e.y - s.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return Math.hypot(p.x - s.x, p.y - s.y);
  }

  const t = ((p.x - s.x) * dx + (p.y - s.y) * dy) / lengthSquared;
  const clampedT = Math.max(0, Math.min(1, t));
  const projX = s.x + clampedT * dx;
  const projY = s.y + clampedT * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

/** Ramer–Douglas–Peucker polyline simplification. Keeps the first and last points. */
export function simplifyShape(points: LatLon[], toleranceMeters: number): LatLon[] {
  if (points.length <= 2) {
    return points;
  }

  const first = points[0] as LatLon;
  const last = points[points.length - 1] as LatLon;

  let maxDistance = -1;
  let maxIndex = -1;
  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistanceMeters(points[i] as LatLon, first, last);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  if (maxDistance <= toleranceMeters) {
    return [first, last];
  }

  const left = simplifyShape(points.slice(0, maxIndex + 1), toleranceMeters);
  const right = simplifyShape(points.slice(maxIndex), toleranceMeters);
  return [...left.slice(0, -1), ...right];
}
