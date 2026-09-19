import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_LAYERS } from "./map-layers";

describe("DEFAULT_MAP_LAYERS", () => {
  it("shows both live vehicles and stops by default", () => {
    expect(DEFAULT_MAP_LAYERS).toEqual({ showVehicles: true, showStops: true });
  });
});
