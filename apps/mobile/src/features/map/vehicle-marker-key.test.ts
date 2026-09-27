import type { VehicleDto } from "@transit/contracts";
import { describe, expect, it } from "vitest";
import { sameVehicleMarker, vehicleMarkerKey } from "./vehicle-marker-key";

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
  it("stays the same when only position, bearing or update time change", () => {
    const before = vehicleMarkerKey(
      vehicle({ lat: 44.9, lon: -93.2, bearing: 0, updatedAt: 1000 }),
    );
    const after = vehicleMarkerKey(
      vehicle({ lat: 44.95, lon: -93.25, bearing: 135, updatedAt: 2000 }),
    );
    expect(after).toBe(before);
  });

  it("changes when the route color changes", () => {
    const before = vehicleMarkerKey(vehicle({ routeColor: "#0033A0" }));
    const after = vehicleMarkerKey(vehicle({ routeColor: "#A62A2A" }));
    expect(after).not.toBe(before);
  });

  it("changes when the route number changes", () => {
    expect(vehicleMarkerKey(vehicle({ routeShortName: "68" }))).not.toBe(
      vehicleMarkerKey(vehicle()),
    );
  });
});

describe("vehicleMarkerKey (mode)", () => {
  it("changes when the transit mode changes, so the shape and glyph are redrawn", () => {
    expect(vehicleMarkerKey(vehicle({ mode: "lightRail" }))).not.toBe(
      vehicleMarkerKey(vehicle({ mode: "bus" })),
    );
  });
});

describe("sameVehicleMarker", () => {
  it("is false when the transit mode changes", () => {
    expect(sameVehicleMarker(vehicle({ mode: "bus" }), vehicle({ mode: "brt" }))).toBe(false);
  });

  it("is true for a new object with the same drawn values", () => {
    expect(sameVehicleMarker(vehicle({ updatedAt: 1000 }), vehicle({ updatedAt: 2000 }))).toBe(
      true,
    );
  });

  it.each([
    ["lat", { lat: 44.91 }],
    ["lon", { lon: -93.21 }],
    ["bearing", { bearing: 90 }],
    ["route number", { routeShortName: "68" }],
    ["route color", { routeColor: "#FFFFFF" }],
    ["text color", { routeTextColor: "#000000" }],
    ["headsign", { headsign: "Downtown" }],
  ] satisfies [string, Partial<VehicleDto>][])("is false when the %s changes", (_name, change) => {
    expect(sameVehicleMarker(vehicle(), vehicle(change))).toBe(false);
  });
});
