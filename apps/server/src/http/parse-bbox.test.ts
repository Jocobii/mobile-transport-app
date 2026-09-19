import { describe, expect, it } from "vitest";
import { parseBbox } from "./parse-bbox";

const MAX_SPAN = 0.06;

function params(query: string): URLSearchParams {
  return new URLSearchParams(query);
}

describe("parseBbox", () => {
  it("accepts a valid bbox in minLon,minLat,maxLon,maxLat order", () => {
    const result = parseBbox(params("bbox=-93.28,44.97,-93.25,44.99"), MAX_SPAN);
    expect(result).toEqual({
      ok: true,
      value: { minLat: 44.97, minLon: -93.28, maxLat: 44.99, maxLon: -93.25 },
    });
  });

  it("rejects a missing bbox", () => {
    expect(parseBbox(params(""), MAX_SPAN).ok).toBe(false);
  });

  it("rejects a bbox without exactly 4 values", () => {
    expect(parseBbox(params("bbox=1,2,3"), MAX_SPAN).ok).toBe(false);
    expect(parseBbox(params("bbox=1,2,3,4,5"), MAX_SPAN).ok).toBe(false);
  });

  it("rejects non-numeric or non-finite values", () => {
    expect(parseBbox(params("bbox=a,44.97,-93.25,44.99"), MAX_SPAN).ok).toBe(false);
    expect(parseBbox(params("bbox=NaN,44.97,-93.25,44.99"), MAX_SPAN).ok).toBe(false);
  });

  it("rejects reversed min/max values", () => {
    expect(parseBbox(params("bbox=-93.25,44.99,-93.28,44.97"), MAX_SPAN).ok).toBe(false);
  });

  it("rejects latitude or longitude out of range", () => {
    expect(parseBbox(params("bbox=-93.28,-91,-93.25,44.99"), MAX_SPAN).ok).toBe(false);
    expect(parseBbox(params("bbox=-181,44.97,-93.25,44.99"), MAX_SPAN).ok).toBe(false);
  });

  it("rejects a span larger than the configured limit", () => {
    expect(parseBbox(params("bbox=-93.4,44.8,-93.2,45.0"), MAX_SPAN).ok).toBe(false);
  });

  it("accepts a span exactly at the limit", () => {
    const result = parseBbox(
      params(`bbox=-93.30,44.90,${-93.3 + MAX_SPAN},${44.9 + MAX_SPAN}`),
      MAX_SPAN,
    );
    expect(result.ok).toBe(true);
  });
});
