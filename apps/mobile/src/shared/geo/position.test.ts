import { describe, expect, it } from "vitest";
import { distanceMeters, hasMovedAtLeast } from "./position";

describe("distanceMeters", () => {
  it("returns zero for the same point", () => {
    const point = { lat: 44.9778, lon: -93.265 };
    expect(distanceMeters(point, point)).toBe(0);
  });

  it("measures one degree of latitude as about 111.2 km", () => {
    const meters = distanceMeters({ lat: 0, lon: 0 }, { lat: 1, lon: 0 });
    expect(Math.round(meters)).toBe(111_195);
  });

  it("is symmetric", () => {
    const a = { lat: 44.98, lon: -93.27 };
    const b = { lat: 44.88, lon: -93.2 };
    expect(distanceMeters(a, b)).toBe(distanceMeters(b, a));
  });
});

describe("hasMovedAtLeast", () => {
  const origin = { lat: 44.9778, lon: -93.265 };

  it("is false for a move under the threshold", () => {
    // 0.0002° of latitude is about 22 m.
    expect(hasMovedAtLeast(origin, { lat: 44.978, lon: -93.265 }, 50)).toBe(false);
  });

  it("is true for a move over the threshold", () => {
    // 0.001° of latitude is about 111 m.
    expect(hasMovedAtLeast(origin, { lat: 44.9788, lon: -93.265 }, 50)).toBe(true);
  });

  it("counts a move of exactly the threshold", () => {
    expect(hasMovedAtLeast(origin, origin, 0)).toBe(true);
  });
});
