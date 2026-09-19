import type { Region } from "react-native-maps";

/** A geographic bounding box in degrees. */
export interface ViewportBounds {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}

/** Bounding box of a map `Region` (its visible rectangle). */
export function regionToBounds(region: Region): ViewportBounds {
  const latHalf = region.latitudeDelta / 2;
  const lonHalf = region.longitudeDelta / 2;
  return {
    minLat: region.latitude - latHalf,
    maxLat: region.latitude + latHalf,
    minLon: region.longitude - lonHalf,
    maxLon: region.longitude + lonHalf,
  };
}

/** Grows a bounding box by `factor` of its span on every side (0.25 = 25% per side). */
export function expandBounds(bounds: ViewportBounds, factor: number): ViewportBounds {
  const latPad = (bounds.maxLat - bounds.minLat) * factor;
  const lonPad = (bounds.maxLon - bounds.minLon) * factor;
  return {
    minLat: bounds.minLat - latPad,
    maxLat: bounds.maxLat + latPad,
    minLon: bounds.minLon - lonPad,
    maxLon: bounds.maxLon + lonPad,
  };
}

/** Rounds a bounding box outward to the nearest multiple of `gridDegrees`. */
export function snapBoundsOutward(bounds: ViewportBounds, gridDegrees: number): ViewportBounds {
  return {
    minLat: Math.floor(bounds.minLat / gridDegrees) * gridDegrees,
    maxLat: Math.ceil(bounds.maxLat / gridDegrees) * gridDegrees,
    minLon: Math.floor(bounds.minLon / gridDegrees) * gridDegrees,
    maxLon: Math.ceil(bounds.maxLon / gridDegrees) * gridDegrees,
  };
}

/** Whether `inner` is entirely inside `outer` (already-fetched area still covers the view). */
export function containsBounds(outer: ViewportBounds, inner: ViewportBounds): boolean {
  return (
    inner.minLat >= outer.minLat &&
    inner.maxLat <= outer.maxLat &&
    inner.minLon >= outer.minLon &&
    inner.maxLon <= outer.maxLon
  );
}

/** Whether a region is zoomed in enough for a layer gated at `gateLatitudeDelta`. */
export function isWithinZoomGate(region: Region, gateLatitudeDelta: number): boolean {
  return region.latitudeDelta <= gateLatitudeDelta;
}
