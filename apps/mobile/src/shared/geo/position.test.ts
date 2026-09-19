import { describe, expect, it } from "vitest";
import { distanceMeters } from "./position";

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
