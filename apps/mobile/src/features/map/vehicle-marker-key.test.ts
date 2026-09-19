import type { VehicleDto } from "@transit/contracts";
import { describe, expect, it } from "vitest";
import { BEARING_STEP_DEGREES } from "./map-config";
import { markerBearing, vehicleMarkerKey } from "./vehicle-marker-key";

function vehicle(overrides: Partial<VehicleDto> = {}): VehicleDto {
  return {
    id: "v1",
    routeId: "mvta:436",
    routeShortName: "436",
    directionId: 0,
    headsign: "Eagan Transit Station",
    tripId: "trip-1",
    updatedAt: 1000,
    lat: 44.9,
    lon: -93.2,
    ...overrides,
  };
}

describe("vehicleMarkerKey", () => {
  it("stays the same when only position or update time change", () => {
    const before = vehicleMarkerKey(vehicle({ lat: 44.9, lon: -93.2, updatedAt: 1000 }));
    const after = vehicleMarkerKey(vehicle({ lat: 44.95, lon: -93.25, updatedAt: 2000 }));
    expect(after).toBe(before);
  });

  it("changes when the route color changes", () => {
    const before = vehicleMarkerKey(vehicle({ routeColor: "#0033A0" }));
    const after = vehicleMarkerKey(vehicle({ routeColor: "#A62A2A" }));
    expect(after).not.toBe(before);
  });

  it("changes when the rounded bearing changes", () => {
    const before = vehicleMarkerKey(vehicle({ bearing: 0 }));
    const after = vehicleMarkerKey(vehicle({ bearing: BEARING_STEP_DEGREES * 2 }));
    expect(after).not.toBe(before);
  });

  it("stays the same for a bearing change smaller than the marker step", () => {
    const before = vehicleMarkerKey(vehicle({ bearing: 0 }));
    const after = vehicleMarkerKey(vehicle({ bearing: BEARING_STEP_DEGREES / 4 }));
    expect(after).toBe(before);
  });
});

describe("markerBearing", () => {
  it("is undefined when the vehicle reports no bearing", () => {
    expect(markerBearing(vehicle({ bearing: undefined }))).toBeUndefined();
  });

  it("rounds to the nearest marker step", () => {
    expect(markerBearing(vehicle({ bearing: BEARING_STEP_DEGREES * 1.4 }))).toBe(
      BEARING_STEP_DEGREES,
    );
  });
});
