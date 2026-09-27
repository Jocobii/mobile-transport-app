import type { VehicleDto } from "@transit/contracts";
import type { Region } from "react-native-maps";
import { describe, expect, it } from "vitest";
import { VEHICLE_LABEL_MAX_SHOWN } from "./map-config";
import { labelWidth, placeVehicleLabels, sameLabelDetails } from "./vehicle-label-placement";

// 0.0001° per dp both ways, so vehicles can be placed in screen dp from the top-left corner.
const DEG_PER_DP = 0.0001;
const SIZE = { width: 360, height: 720 };
const REGION: Region = {
  latitude: 45,
  longitude: -93,
  latitudeDelta: SIZE.height * DEG_PER_DP,
  longitudeDelta: SIZE.width * DEG_PER_DP,
};
const NOW = 10_000;

function at(id: string, x: number, y: number, overrides: Partial<VehicleDto> = {}): VehicleDto {
  return {
    id,
    routeId: "mvta:436",
    routeShortName: "436",
    directionId: 0,
    headsign: "Eagan",
    tripId: `trip-${id}`,
    updatedAt: NOW,
    lat: REGION.latitude + REGION.latitudeDelta / 2 - y * DEG_PER_DP,
    lon: REGION.longitude - REGION.longitudeDelta / 2 + x * DEG_PER_DP,
    ...overrides,
  };
}

function place(vehicles: VehicleDto[], region = REGION, size = SIZE) {
  return placeVehicleLabels(vehicles, region, size, NOW);
}

describe("placeVehicleLabels", () => {
  it("shows the full label on every vehicle when they are scattered", () => {
    const details = place([at("a", 100, 150), at("b", 260, 400), at("c", 120, 620)]);
    expect([...details.values()]).toEqual(["full", "full", "full"]);
  });

  it("shows no label on a vehicle whose label would cover a neighbour", () => {
    // Almost on top of each other: the one nearer the center keeps its label.
    const details = place([at("near", 180, 360), at("crowd", 190, 365)]);
    expect(details.get("near")).toBe("full");
    expect(details.get("crowd")).toBe("none");
  });

  it("falls back to the number when only the short label fits", () => {
    // `b` sits right next to where a's full label would reach, but clear of its number label.
    const details = place([at("a", 180, 360), at("b", 225, 340)]);
    expect(details.get("a")).toBe("number");
    expect(details.get("b")).toBe("none");
  });

  it("places trains first, even when a bus is nearer the center", () => {
    const details = place([
      at("bus", 180, 360),
      // Farther from the center, but its label would clash with the bus's: the train wins.
      at("train", 240, 360, { mode: "lightRail", routeShortName: "Blue" }),
    ]);
    expect(details.get("train")).toBe("full");
    expect(details.get("bus")).toBe("none");
  });

  it("gives off-screen vehicles no label", () => {
    expect(place([at("off", -50, 360)]).get("off")).toBe("none");
  });

  it("gives no label before the map reports its region or size", () => {
    const vehicles = [at("a", 180, 360)];
    expect(placeVehicleLabels(vehicles, undefined, SIZE, NOW).get("a")).toBe("none");
    expect(placeVehicleLabels(vehicles, REGION, undefined, NOW).get("a")).toBe("none");
  });

  it(`draws at most ${VEHICLE_LABEL_MAX_SHOWN} labels, even with room for more`, () => {
    const big = { width: 2000, height: 2000 };
    const region: Region = {
      ...REGION,
      latitudeDelta: big.height * DEG_PER_DP,
      longitudeDelta: big.width * DEG_PER_DP,
    };
    const vehicles: VehicleDto[] = [];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        vehicles.push({
          ...at(`v${row}-${col}`, 0, 0),
          lat: region.latitude + region.latitudeDelta / 2 - (120 + row * 230) * DEG_PER_DP,
          lon: region.longitude - region.longitudeDelta / 2 + (120 + col * 230) * DEG_PER_DP,
        });
      }
    }
    const shown = [...place(vehicles, region, big).values()].filter((d) => d !== "none");
    expect(shown).toHaveLength(VEHICLE_LABEL_MAX_SHOWN);
  });

  it("is stable: the same input gives the same placement", () => {
    const vehicles = [at("a", 180, 360), at("b", 190, 365), at("c", 50, 100)];
    expect(sameLabelDetails(place(vehicles), place([...vehicles].reverse()))).toBe(true);
  });
});

describe("labelWidth", () => {
  it("is wider for the full label, and wider still when the position is outdated", () => {
    const number = labelWidth("436", "number", false);
    const full = labelWidth("436", "full", false);
    expect(full).toBeGreaterThan(number);
    expect(labelWidth("436", "full", true)).toBeGreaterThan(full);
  });
});

describe("sameLabelDetails", () => {
  it("compares by content", () => {
    const a = new Map([["x", "full" as const]]);
    expect(sameLabelDetails(a, new Map([["x", "full" as const]]))).toBe(true);
    expect(sameLabelDetails(a, new Map([["x", "number" as const]]))).toBe(false);
  });
});
