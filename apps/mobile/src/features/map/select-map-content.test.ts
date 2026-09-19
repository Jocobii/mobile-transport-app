import type { NearbyStopDto, StopSummaryDto, VehicleDto } from "@transit/contracts";
import { describe, expect, it } from "vitest";
import type { VehicleMapContent } from "@/features/vehicle/use-vehicle-view";
import { DEFAULT_MAP_LAYERS } from "./map-layers";
import { selectMapContent } from "./select-map-content";

function stopSummary(id: string): StopSummaryDto {
  return { id, code: id, name: id, lat: 44.9, lon: -93.2 };
}

function vehicle(id: string): VehicleDto {
  return {
    id,
    routeId: "mvta:436",
    routeShortName: "436",
    directionId: 0,
    headsign: "Eagan Transit Station",
    tripId: `trip-${id}`,
    updatedAt: 1000,
    lat: 44.9,
    lon: -93.2,
  };
}

function nearbyStop(id: string, approachingVehicles: VehicleDto[]): NearbyStopDto {
  return {
    stop: stopSummary(id),
    distanceMeters: 100,
    routes: [],
    nextArrivals: [],
    approachingVehicles,
  };
}

const EMPTY_VEHICLE_CONTENT: VehicleMapContent = { stops: [], vehicles: [] };

describe("selectMapContent", () => {
  describe("nearby and search panels", () => {
    const nearbyStops = [nearbyStop("a", [vehicle("v1")]), nearbyStop("b", [vehicle("v2")])];

    for (const panelKind of ["nearby", "search"] as const) {
      it(`shows every stop and every approaching vehicle with both layers on (${panelKind})`, () => {
        const result = selectMapContent(
          panelKind,
          nearbyStops,
          undefined,
          undefined,
          EMPTY_VEHICLE_CONTENT,
          undefined,
          DEFAULT_MAP_LAYERS,
          undefined,
          [],
          [],
        );
        expect(result.stops.map((s) => s.id)).toEqual(["a", "b"]);
        expect(result.vehicles.map((v) => v.id)).toEqual(["v1", "v2"]);
      });

      it(`hides vehicles when showVehicles is off (${panelKind})`, () => {
        const result = selectMapContent(
          panelKind,
          nearbyStops,
          undefined,
          undefined,
          EMPTY_VEHICLE_CONTENT,
          undefined,
          { showVehicles: false, showStops: true },
          undefined,
          [],
          [],
        );
        expect(result.stops.map((s) => s.id)).toEqual(["a", "b"]);
        expect(result.vehicles).toEqual([]);
      });

      it(`hides stops except the highlighted one when showStops is off (${panelKind})`, () => {
        const result = selectMapContent(
          panelKind,
          nearbyStops,
          undefined,
          undefined,
          EMPTY_VEHICLE_CONTENT,
          undefined,
          { showVehicles: true, showStops: false },
          "b",
          [],
          [],
        );
        expect(result.stops.map((s) => s.id)).toEqual(["b"]);
        expect(result.vehicles.map((v) => v.id)).toEqual(["v1", "v2"]);
      });

      it(`hides every stop when showStops is off and nothing is highlighted (${panelKind})`, () => {
        const result = selectMapContent(
          panelKind,
          nearbyStops,
          undefined,
          undefined,
          EMPTY_VEHICLE_CONTENT,
          undefined,
          { showVehicles: true, showStops: false },
          undefined,
          [],
          [],
        );
        expect(result.stops).toEqual([]);
      });

      it(`hides both layers when both are off (${panelKind})`, () => {
        const result = selectMapContent(
          panelKind,
          nearbyStops,
          undefined,
          undefined,
          EMPTY_VEHICLE_CONTENT,
          undefined,
          { showVehicles: false, showStops: false },
          "a",
          [],
          [],
        );
        expect(result.stops.map((s) => s.id)).toEqual(["a"]);
        expect(result.vehicles).toEqual([]);
      });
    }
  });

  describe("area stops merge + dedupe", () => {
    const nearbyStops = [nearbyStop("a", [])];

    for (const panelKind of ["nearby", "search"] as const) {
      it(`merges area stops with nearby stops when showStops is on (${panelKind})`, () => {
        const result = selectMapContent(
          panelKind,
          nearbyStops,
          undefined,
          undefined,
          EMPTY_VEHICLE_CONTENT,
          undefined,
          DEFAULT_MAP_LAYERS,
          undefined,
          [stopSummary("c"), stopSummary("d")],
          [],
        );
        expect(result.stops.map((s) => s.id)).toEqual(["a", "c", "d"]);
      });

      it(`dedupes area stops that also appear in the nearby list (${panelKind})`, () => {
        const result = selectMapContent(
          panelKind,
          nearbyStops,
          undefined,
          undefined,
          EMPTY_VEHICLE_CONTENT,
          undefined,
          DEFAULT_MAP_LAYERS,
          undefined,
          [stopSummary("a"), stopSummary("c")],
          [],
        );
        expect(result.stops.map((s) => s.id)).toEqual(["a", "c"]);
      });

      it(`excludes area stops entirely when showStops is off (${panelKind})`, () => {
        const result = selectMapContent(
          panelKind,
          nearbyStops,
          undefined,
          undefined,
          EMPTY_VEHICLE_CONTENT,
          undefined,
          { showVehicles: true, showStops: false },
          "a",
          [stopSummary("c")],
          [],
        );
        expect(result.stops.map((s) => s.id)).toEqual(["a"]);
      });
    }
  });

  describe("area vehicles merge + dedupe", () => {
    const nearbyStops = [nearbyStop("a", [vehicle("v1")])];

    for (const panelKind of ["nearby", "search"] as const) {
      it(`merges area vehicles with approaching vehicles when showVehicles is on (${panelKind})`, () => {
        const result = selectMapContent(
          panelKind,
          nearbyStops,
          undefined,
          undefined,
          EMPTY_VEHICLE_CONTENT,
          undefined,
          DEFAULT_MAP_LAYERS,
          undefined,
          [],
          [vehicle("v2"), vehicle("v3")],
        );
        expect(result.vehicles.map((v) => v.id)).toEqual(["v1", "v2", "v3"]);
      });

      it(`keeps the approaching version when a vehicle appears in both lists (${panelKind})`, () => {
        const areaDuplicate: VehicleDto = { ...vehicle("v1"), headsign: "Different headsign" };
        const result = selectMapContent(
          panelKind,
          nearbyStops,
          undefined,
          undefined,
          EMPTY_VEHICLE_CONTENT,
          undefined,
          DEFAULT_MAP_LAYERS,
          undefined,
          [],
          [areaDuplicate],
        );
        expect(result.vehicles).toEqual([vehicle("v1")]);
      });

      it(`excludes area vehicles entirely when showVehicles is off (${panelKind})`, () => {
        const result = selectMapContent(
          panelKind,
          nearbyStops,
          undefined,
          undefined,
          EMPTY_VEHICLE_CONTENT,
          undefined,
          { showVehicles: false, showStops: true },
          undefined,
          [],
          [vehicle("v2")],
        );
        expect(result.vehicles).toEqual([]);
      });
    }
  });

  it("ignores layers for the stop panel", () => {
    const result = selectMapContent(
      "stop",
      [],
      stopSummary("s1"),
      undefined,
      EMPTY_VEHICLE_CONTENT,
      undefined,
      { showVehicles: false, showStops: false },
      undefined,
      [],
      [],
    );
    expect(result.stops.map((s) => s.id)).toEqual(["s1"]);
  });

  it("draws only the timetable's stop and ignores layers for the timetable panel", () => {
    const result = selectMapContent(
      "timetable",
      [nearbyStop("other", [vehicle("v1")])],
      stopSummary("s1"),
      undefined,
      EMPTY_VEHICLE_CONTENT,
      undefined,
      { showVehicles: true, showStops: true },
      undefined,
      [stopSummary("area")],
      [vehicle("v2")],
    );
    expect(result.stops.map((s) => s.id)).toEqual(["s1"]);
    expect(result.vehicles).toEqual([]);
  });

  it("draws nothing for the timetable panel until its stop is known", () => {
    const result = selectMapContent(
      "timetable",
      [],
      undefined,
      undefined,
      EMPTY_VEHICLE_CONTENT,
      undefined,
      DEFAULT_MAP_LAYERS,
      undefined,
      [],
      [],
    );
    expect(result).toEqual({ stops: [], vehicles: [] });
  });

  it("ignores layers for the route panel", () => {
    const routeVehicles = [vehicle("v1")];
    const result = selectMapContent(
      "route",
      [],
      undefined,
      routeVehicles,
      EMPTY_VEHICLE_CONTENT,
      undefined,
      { showVehicles: false, showStops: false },
      undefined,
      [],
      [],
    );
    expect(result.vehicles).toEqual(routeVehicles);
  });

  it("ignores layers for the trip panel", () => {
    const tripStop = stopSummary("s2");
    const result = selectMapContent(
      "trip",
      [],
      undefined,
      undefined,
      EMPTY_VEHICLE_CONTENT,
      tripStop,
      { showVehicles: false, showStops: false },
      undefined,
      [],
      [],
    );
    expect(result.stops).toEqual([tripStop]);
  });

  it("ignores layers for the vehicle panel and returns its own map content", () => {
    const vehicleContent: VehicleMapContent = {
      stops: [stopSummary("s3")],
      vehicles: [vehicle("v1")],
    };
    const result = selectMapContent(
      "vehicle",
      [],
      undefined,
      undefined,
      vehicleContent,
      undefined,
      { showVehicles: false, showStops: false },
      undefined,
      [],
      [],
    );
    expect(result).toEqual(vehicleContent);
  });
});
