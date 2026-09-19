import type { Region } from "react-native-maps";
import { describe, expect, it } from "vitest";
import {
  containsBounds,
  expandBounds,
  isWithinZoomGate,
  regionToBounds,
  snapBoundsOutward,
  type ViewportBounds,
} from "./viewport";

/** Floating-point-safe bounds comparison (arithmetic on degrees leaves tiny epsilon errors). */
function expectBoundsCloseTo(actual: ViewportBounds, expected: ViewportBounds): void {
  expect(actual.minLat).toBeCloseTo(expected.minLat, 9);
  expect(actual.maxLat).toBeCloseTo(expected.maxLat, 9);
  expect(actual.minLon).toBeCloseTo(expected.minLon, 9);
  expect(actual.maxLon).toBeCloseTo(expected.maxLon, 9);
}

const REGION: Region = {
  latitude: 44.95,
  longitude: -93.25,
  latitudeDelta: 0.02,
  longitudeDelta: 0.04,
};

describe("regionToBounds", () => {
  it("returns the box centered on the region with half the delta on each side", () => {
    expectBoundsCloseTo(regionToBounds(REGION), {
      minLat: 44.94,
      maxLat: 44.96,
      minLon: -93.27,
      maxLon: -93.23,
    });
  });
});

describe("expandBounds", () => {
  it("grows each side by the given fraction of the span", () => {
    const bounds: ViewportBounds = { minLat: 44.9, maxLat: 45.0, minLon: -93.3, maxLon: -93.2 };
    expectBoundsCloseTo(expandBounds(bounds, 0.25), {
      minLat: 44.875,
      maxLat: 45.025,
      minLon: -93.325,
      maxLon: -93.175,
    });
  });

  it("is a no-op with factor 0", () => {
    const bounds: ViewportBounds = { minLat: 44.9, maxLat: 45.0, minLon: -93.3, maxLon: -93.2 };
    expect(expandBounds(bounds, 0)).toEqual(bounds);
  });
});

describe("snapBoundsOutward", () => {
  it("rounds min down and max up to the grid", () => {
    const bounds: ViewportBounds = {
      minLat: 44.9123,
      maxLat: 44.9177,
      minLon: -93.2043,
      maxLon: -93.1981,
    };
    expectBoundsCloseTo(snapBoundsOutward(bounds, 0.005), {
      minLat: 44.91,
      maxLat: 44.92,
      minLon: -93.205,
      maxLon: -93.195,
    });
  });

  it("leaves a box already on the grid unchanged", () => {
    const bounds: ViewportBounds = {
      minLat: 44.91,
      maxLat: 44.92,
      minLon: -93.205,
      maxLon: -93.195,
    };
    expectBoundsCloseTo(snapBoundsOutward(bounds, 0.005), bounds);
  });
});

describe("containsBounds", () => {
  const outer: ViewportBounds = { minLat: 44.9, maxLat: 45.0, minLon: -93.3, maxLon: -93.2 };

  it("is true when inner is fully inside outer, including equal edges", () => {
    expect(containsBounds(outer, outer)).toBe(true);
    expect(
      containsBounds(outer, { minLat: 44.95, maxLat: 44.96, minLon: -93.26, maxLon: -93.25 }),
    ).toBe(true);
  });

  it("is false when inner crosses any edge of outer", () => {
    expect(containsBounds(outer, { ...outer, minLat: 44.89 })).toBe(false);
    expect(containsBounds(outer, { ...outer, maxLat: 45.01 })).toBe(false);
    expect(containsBounds(outer, { ...outer, minLon: -93.31 })).toBe(false);
    expect(containsBounds(outer, { ...outer, maxLon: -93.19 })).toBe(false);
  });
});

describe("isWithinZoomGate", () => {
  it("is true when latitudeDelta is at or below the gate", () => {
    expect(isWithinZoomGate({ ...REGION, latitudeDelta: 0.03 }, 0.03)).toBe(true);
    expect(isWithinZoomGate({ ...REGION, latitudeDelta: 0.02 }, 0.03)).toBe(true);
  });

  it("is false when latitudeDelta is above the gate", () => {
    expect(isWithinZoomGate({ ...REGION, latitudeDelta: 0.031 }, 0.03)).toBe(false);
  });
});
