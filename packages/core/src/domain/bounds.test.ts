import { describe, expect, it } from "vitest";
import { boundsCenter, boundsContain, boundsSpan } from "./bounds";

const BOUNDS = { minLat: 44.9, minLon: -93.3, maxLat: 45.0, maxLon: -93.2 };

describe("boundsContain", () => {
  it("is true for a point inside the box", () => {
    expect(boundsContain(BOUNDS, { lat: 44.95, lon: -93.25 })).toBe(true);
  });

  it("is true on the edges (inclusive)", () => {
    expect(boundsContain(BOUNDS, { lat: BOUNDS.minLat, lon: BOUNDS.minLon })).toBe(true);
    expect(boundsContain(BOUNDS, { lat: BOUNDS.maxLat, lon: BOUNDS.maxLon })).toBe(true);
  });

  it("is false outside any single axis", () => {
    expect(boundsContain(BOUNDS, { lat: 44.8, lon: -93.25 })).toBe(false);
    expect(boundsContain(BOUNDS, { lat: 44.95, lon: -93.5 })).toBe(false);
  });
});

describe("boundsCenter", () => {
  it("is the midpoint of each axis", () => {
    expect(boundsCenter(BOUNDS)).toEqual({ lat: 44.95, lon: -93.25 });
  });
});

describe("boundsSpan", () => {
  it("is the width and height in degrees", () => {
    const { latSpan, lonSpan } = boundsSpan(BOUNDS);
    expect(latSpan).toBeCloseTo(0.1, 9);
    expect(lonSpan).toBeCloseTo(0.1, 9);
  });
});
