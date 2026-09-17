import { describe, expect, it } from "vitest";
import { boundingBox, haversineMeters } from "./geo";

describe("haversineMeters", () => {
  it("is 0 for the same point", () => {
    expect(haversineMeters({ lat: 44.88, lon: -93.2 }, { lat: 44.88, lon: -93.2 })).toBe(0);
  });

  it("is close to the known distance between two nearby points", () => {
    const distance = haversineMeters({ lat: 44.88, lon: -93.2 }, { lat: 44.889, lon: -93.2 });
    expect(Math.abs(distance - 1000) < 20).toBe(true);
  });
});

describe("boundingBox", () => {
  it("contains the center and grows with the radius", () => {
    const center = { lat: 44.88, lon: -93.2 };
    const small = boundingBox(center, 100);
    const large = boundingBox(center, 1000);
    expect(small.minLat < center.lat && center.lat < small.maxLat).toBe(true);
    expect(large.maxLat - large.minLat > small.maxLat - small.minLat).toBe(true);
  });
});
