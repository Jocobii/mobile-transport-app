import { describe, expect, it } from "vitest";
import {
  parseDirectionId,
  parseLatLon,
  parseOptionalLatLon,
  parsePathId,
  parseRadius,
  parseSearchQuery,
} from "./params";

const RADIUS_SETTINGS = {
  nearbyDefaultRadiusMeters: 500,
  nearbyMinRadiusMeters: 50,
  nearbyMaxRadiusMeters: 2000,
};

const SEARCH_SETTINGS = { searchMaxQueryLength: 50 };

function params(query: string): URLSearchParams {
  return new URLSearchParams(query);
}

describe("parseLatLon", () => {
  it("accepts valid coordinates", () => {
    const result = parseLatLon(params("lat=44.88&lon=-93.2"));
    expect(result).toEqual({ ok: true, value: { lat: 44.88, lon: -93.2 } });
  });

  it("rejects missing lat or lon", () => {
    expect(parseLatLon(params("lat=44.88")).ok).toBe(false);
    expect(parseLatLon(params("")).ok).toBe(false);
  });

  it("rejects non-numeric values", () => {
    expect(parseLatLon(params("lat=abc&lon=-93.2")).ok).toBe(false);
  });

  it("rejects lat out of [-90, 90]", () => {
    expect(parseLatLon(params("lat=999&lon=0")).ok).toBe(false);
    expect(parseLatLon(params("lat=-91&lon=0")).ok).toBe(false);
  });

  it("rejects lon out of [-180, 180]", () => {
    expect(parseLatLon(params("lat=0&lon=181")).ok).toBe(false);
  });

  it("accepts boundary values", () => {
    expect(parseLatLon(params("lat=90&lon=180")).ok).toBe(true);
    expect(parseLatLon(params("lat=-90&lon=-180")).ok).toBe(true);
  });
});

describe("parseOptionalLatLon", () => {
  it("accepts both absent", () => {
    expect(parseOptionalLatLon(params(""))).toEqual({ ok: true, value: undefined });
  });

  it("rejects only one of lat/lon present", () => {
    expect(parseOptionalLatLon(params("lat=1")).ok).toBe(false);
    expect(parseOptionalLatLon(params("lon=1")).ok).toBe(false);
  });

  it("accepts both present and valid", () => {
    const result = parseOptionalLatLon(params("lat=1&lon=2"));
    expect(result).toEqual({ ok: true, value: { lat: 1, lon: 2 } });
  });
});

describe("parseRadius", () => {
  it("defaults when omitted", () => {
    expect(parseRadius(params(""), RADIUS_SETTINGS)).toEqual({ ok: true, value: 500 });
  });

  it("rejects a non-integer radius", () => {
    expect(parseRadius(params("radius=500.5"), RADIUS_SETTINGS).ok).toBe(false);
  });

  it("rejects a radius outside [min, max]", () => {
    expect(parseRadius(params("radius=49"), RADIUS_SETTINGS).ok).toBe(false);
    expect(parseRadius(params("radius=2001"), RADIUS_SETTINGS).ok).toBe(false);
  });

  it("accepts boundary values", () => {
    expect(parseRadius(params("radius=50"), RADIUS_SETTINGS)).toEqual({ ok: true, value: 50 });
    expect(parseRadius(params("radius=2000"), RADIUS_SETTINGS)).toEqual({ ok: true, value: 2000 });
  });
});

describe("parseDirectionId", () => {
  it("defaults to undefined when omitted", () => {
    expect(parseDirectionId(params(""))).toEqual({ ok: true, value: undefined });
  });

  it("accepts 0 and 1", () => {
    expect(parseDirectionId(params("directionId=0"))).toEqual({ ok: true, value: 0 });
    expect(parseDirectionId(params("directionId=1"))).toEqual({ ok: true, value: 1 });
  });

  it("rejects any other value", () => {
    expect(parseDirectionId(params("directionId=2")).ok).toBe(false);
    expect(parseDirectionId(params("directionId=north")).ok).toBe(false);
  });
});

describe("parseSearchQuery", () => {
  it("accepts a normal query", () => {
    expect(parseSearchQuery(params("q=436"), SEARCH_SETTINGS)).toEqual({ ok: true, value: "436" });
  });

  it("rejects a missing q", () => {
    expect(parseSearchQuery(params(""), SEARCH_SETTINGS).ok).toBe(false);
  });

  it("rejects a query that's empty after normalization", () => {
    expect(parseSearchQuery(params("q=   "), SEARCH_SETTINGS).ok).toBe(false);
  });

  it("rejects a query longer than the configured max", () => {
    const long = "a".repeat(51);
    expect(parseSearchQuery(params(`q=${long}`), SEARCH_SETTINGS).ok).toBe(false);
  });

  it("accepts a query at exactly the configured max length", () => {
    const max = "a".repeat(50);
    expect(parseSearchQuery(params(`q=${max}`), SEARCH_SETTINGS).ok).toBe(true);
  });
});

describe("parsePathId", () => {
  it("accepts a normal id", () => {
    expect(parsePathId("56939", 100)).toEqual({ ok: true, value: "56939" });
  });

  it("rejects an empty id", () => {
    expect(parsePathId("", 100).ok).toBe(false);
  });

  it("rejects an id longer than maxLength", () => {
    expect(parsePathId("a".repeat(101), 100).ok).toBe(false);
  });

  it("accepts an id at exactly maxLength", () => {
    expect(parsePathId("a".repeat(100), 100).ok).toBe(true);
  });
});
