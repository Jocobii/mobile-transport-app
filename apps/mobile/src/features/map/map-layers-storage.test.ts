import { describe, expect, it } from "vitest";
import { parseStoredLayers } from "./map-layers-storage";

describe("parseStoredLayers", () => {
  it("returns the defaults when nothing is stored yet", () => {
    expect(parseStoredLayers(null)).toEqual({ showVehicles: true, showStops: true });
  });

  it("parses a valid stored value", () => {
    expect(parseStoredLayers('{"showVehicles":false,"showStops":true}')).toEqual({
      showVehicles: false,
      showStops: true,
    });
  });

  it("returns the defaults for invalid JSON", () => {
    expect(parseStoredLayers("{not json")).toEqual({ showVehicles: true, showStops: true });
  });

  it("returns the defaults when the stored value is not an object", () => {
    expect(parseStoredLayers("42")).toEqual({ showVehicles: true, showStops: true });
    expect(parseStoredLayers('"on"')).toEqual({ showVehicles: true, showStops: true });
    expect(parseStoredLayers("null")).toEqual({ showVehicles: true, showStops: true });
  });

  it("falls back per field when a value has the wrong type", () => {
    expect(parseStoredLayers('{"showVehicles":"yes","showStops":false}')).toEqual({
      showVehicles: true,
      showStops: false,
    });
  });

  it("falls back per field when a value is missing (partial data)", () => {
    expect(parseStoredLayers('{"showStops":false}')).toEqual({
      showVehicles: true,
      showStops: false,
    });
  });
});
