import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { TransitSettings } from "@transit/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildCatalog } from "../static/build-catalog";
import { createDirectoryGtfsSource } from "../static/gtfs-source";
import { addDays, epochFor } from "../time/gtfs-time";
import { CatalogUnavailableError, createSqliteCatalogProvider } from "./sqlite-catalog-provider";

const FIXTURES_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "test/fixtures",
);

const NOW = 1789597408;
const MSP_TERMINAL_1 = { lat: 44.880248, lon: -93.204865 };

const TEST_SETTINGS: TransitSettings = {
  realtimeCacheTtlSeconds: 20,
  realtimeStaleAfterSeconds: 120,
  feedFetchTimeoutMs: 8000,
  nearbyRadiusStepsMeters: [500, 1000, 1500],
  nearbyMinStops: 3,
  nearbyMinRadiusMeters: 50,
  nearbyMaxRadiusMeters: 2000,
  nearbyMaxStops: 10,
  nearbyFallbackMaxDistanceMeters: 5000,
  nearbyArrivalsPerStop: 3,
  areaStopsMaxSpanDegrees: 0.06,
  areaStopsMaxResults: 250,
  areaVehiclesMaxSpanDegrees: 0.3,
  areaVehiclesMaxResults: 150,
  routeFilterMaxRoutes: 8,
  arrivalsWindowMinutes: 90,
  stopArrivalsLimit: 30,
  pastArrivalGraceSeconds: 60,
  searchMaxRoutes: 10,
  searchMaxStops: 20,
  searchMaxQueryLength: 50,
  catalogServiceDaysBefore: 1,
  catalogServiceDaysAfter: 13,
  patternLookaheadDays: 7,
  shapeSimplifyToleranceMeters: 5,
  httpUserAgent: "transit-app/0.1 (personal use)",
};

describe("SqliteCatalogProvider (real fixtures: metrotransit + mvta)", () => {
  let tmpDir: string;
  let provider: ReturnType<typeof createSqliteCatalogProvider>;

  beforeAll(async () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "catalog-provider-test-"));
    const outputPath = path.join(tmpDir, "catalog.sqlite");

    await buildCatalog({
      outputPath,
      now: NOW,
      settings: TEST_SETTINGS,
      feeds: [
        {
          config: {
            id: "metrotransit",
            name: "Metro Transit",
            timezone: "America/Chicago",
            staticUrl: "",
            vehiclePositionsUrl: "",
            tripUpdatesUrl: "",
          },
          source: createDirectoryGtfsSource(path.join(FIXTURES_ROOT, "metrotransit/gtfs")),
        },
        {
          config: {
            id: "mvta",
            name: "MVTA",
            timezone: "America/Chicago",
            staticUrl: "",
            vehiclePositionsUrl: "",
            tripUpdatesUrl: "",
          },
          source: createDirectoryGtfsSource(path.join(FIXTURES_ROOT, "mvta/gtfs")),
        },
      ],
    });

    provider = createSqliteCatalogProvider({ databasePath: outputPath });
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns stop 56939 first when searching near MSP Terminal 1", async () => {
    const near = await provider.findStopsNear(MSP_TERMINAL_1, 500, 10);
    expect(near.length > 0).toBe(true);
    expect(near[0]?.stop.id).toBe("56939");
  });

  it("findStopsInBounds returns stop 56939 ordered by distance to the box center, capped and truncated", async () => {
    const bounds = { minLat: 44.878, minLon: -93.207, maxLat: 44.883, maxLon: -93.202 };
    const all = await provider.findStopsInBounds(bounds, 1000);
    expect(all.stops.some((stop) => stop.id === "56939")).toBe(true);
    expect(all.truncated).toBe(false);
    for (let i = 1; i < all.stops.length; i++) {
      const prev = all.stops[i - 1];
      const curr = all.stops[i];
      if (!prev || !curr) continue;
      const center = {
        lat: (bounds.minLat + bounds.maxLat) / 2,
        lon: (bounds.minLon + bounds.maxLon) / 2,
      };
      const distPrev = Math.hypot(prev.lat - center.lat, prev.lon - center.lon);
      const distCurr = Math.hypot(curr.lat - center.lat, curr.lon - center.lon);
      expect(distPrev).toBeLessThanOrEqual(distCurr + 1e-9);
    }

    const limited = await provider.findStopsInBounds(bounds, 1);
    expect(limited.stops).toHaveLength(1);
    expect(limited.truncated).toBe(all.stops.length > 1);
  });

  describe("route filter (EPIC-007)", () => {
    const ROUTE_436 = "mvta:436";

    it("findStopsNear only returns stops served by the chosen route", async () => {
      const filtered = await provider.findStopsNear(MSP_TERMINAL_1, 1500, 50, {
        routeIds: [ROUTE_436],
      });
      const unfiltered = await provider.findStopsNear(MSP_TERMINAL_1, 1500, 50);

      expect(filtered.some((entry) => entry.stop.id === "56939")).toBe(true);
      expect(filtered.length).toBeLessThanOrEqual(unfiltered.length);
      for (const { stop } of filtered) {
        const routes = await provider.getRoutesServingStop(stop.id);
        expect(routes.some((route) => route.id === ROUTE_436)).toBe(true);
      }
    });

    it("an unknown route matches no stops, and an empty list means no restriction", async () => {
      const unknown = await provider.findStopsNear(MSP_TERMINAL_1, 1500, 50, {
        routeIds: ["mvta:does-not-exist"],
      });
      const emptyList = await provider.findStopsNear(MSP_TERMINAL_1, 1500, 50, { routeIds: [] });
      const unfiltered = await provider.findStopsNear(MSP_TERMINAL_1, 1500, 50);

      expect(unknown).toEqual([]);
      expect(emptyList).toEqual(unfiltered);
    });

    it("several routes match the union of their stops", async () => {
      const one = await provider.findStopsNear(MSP_TERMINAL_1, 1500, 50, { routeIds: [ROUTE_436] });
      const both = await provider.findStopsNear(MSP_TERMINAL_1, 1500, 50, {
        routeIds: [ROUTE_436, "metrotransit:54"],
      });

      expect(both.length).toBeGreaterThanOrEqual(one.length);
      for (const entry of one) {
        expect(both.some((other) => other.stop.id === entry.stop.id)).toBe(true);
      }
    });

    it("findNearestStop returns a stop served by the chosen route", async () => {
      const nearest = await provider.findNearestStop(MSP_TERMINAL_1, 5000, {
        routeIds: [ROUTE_436],
      });

      expect(nearest).toBeDefined();
      const routes = await provider.getRoutesServingStop(nearest?.stop.id ?? "");
      expect(routes.some((route) => route.id === ROUTE_436)).toBe(true);
      expect(
        await provider.findNearestStop(MSP_TERMINAL_1, 5000, { routeIds: ["mvta:does-not-exist"] }),
      ).toBeUndefined();
    });

    it("findStopsInBounds only returns stops served by the chosen route", async () => {
      const bounds = { minLat: 44.85, minLon: -93.25, maxLat: 44.9, maxLon: -93.15 };
      const filtered = await provider.findStopsInBounds(bounds, 1000, { routeIds: [ROUTE_436] });
      const unfiltered = await provider.findStopsInBounds(bounds, 1000);

      expect(filtered.stops.length).toBeGreaterThan(0);
      expect(filtered.stops.length).toBeLessThanOrEqual(unfiltered.stops.length);
      for (const stop of filtered.stops) {
        const routes = await provider.getRoutesServingStop(stop.id);
        expect(routes.some((route) => route.id === ROUTE_436)).toBe(true);
      }
    });
  });

  it("searchRoutes('436') finds mvta:436", async () => {
    const routes = await provider.searchRoutes("436", 10);
    expect(routes.some((route) => route.id === "mvta:436")).toBe(true);
  });

  it("searchStops('terminal 1') finds the MSP Terminal 1 stop", async () => {
    const stops = await provider.searchStops("terminal 1", 20);
    expect(stops.some((stop) => stop.id === "56939")).toBe(true);
  });

  it("getRoutePatterns('mvta:436') returns 2 directions", async () => {
    const patterns = await provider.getRoutePatterns("mvta:436");
    expect(patterns.length).toBe(2);
  });

  it("scheduled stop times at 56939 are sorted and within the requested window", async () => {
    const from = NOW - 3600;
    const to = NOW + 3600;
    const stopTimes = await provider.getScheduledStopTimesAtStop("56939", from, to);
    expect(stopTimes.length > 0).toBe(true);
    for (const stopTime of stopTimes) {
      expect(stopTime.time >= from && stopTime.time <= to).toBe(true);
    }
    for (let i = 1; i < stopTimes.length; i++) {
      expect((stopTimes[i]?.time ?? 0) >= (stopTimes[i - 1]?.time ?? 0)).toBe(true);
    }
  });

  it("getServiceDates returns distinct 8-digit dates in ascending order", async () => {
    const dates = await provider.getServiceDates();
    expect(dates.length > 0).toBe(true);
    expect(new Set(dates).size).toBe(dates.length);
    expect(dates.every((date) => /^\d{8}$/.test(date))).toBe(true);
    expect([...dates].sort()).toEqual(dates);
  });

  it("getScheduledStopTimesForServiceDate returns one sorted service day at the stop", async () => {
    const dates = await provider.getServiceDates();
    let date: string | undefined;
    let rows: Awaited<ReturnType<typeof provider.getScheduledStopTimesForServiceDate>> = [];
    for (const candidate of dates) {
      rows = await provider.getScheduledStopTimesForServiceDate("56939", candidate);
      if (rows.length > 0) {
        date = candidate;
        break;
      }
    }
    expect(date).toBeDefined();
    if (date === undefined) return;

    const startOfDay = epochFor(date, 0, "America/Chicago");
    for (const row of rows) {
      expect(row.stopId).toBe("56939");
      expect(row.serviceDate).toBe(date);
      expect(row.time >= startOfDay).toBe(true);
    }
    for (let i = 1; i < rows.length; i++) {
      expect((rows[i]?.time ?? 0) >= (rows[i - 1]?.time ?? 0)).toBe(true);
    }
  });

  it("getScheduledStopTimesForServiceDate excludes trips that end at the stop", async () => {
    const dates = await provider.getServiceDates();
    let checked = 0;
    for (const date of dates) {
      const rows = await provider.getScheduledStopTimesForServiceDate("56939", date);
      for (const row of rows.slice(0, 20)) {
        const trip = await provider.getScheduledStopTimesForTrip(row.tripId, date);
        const lastSequence = Math.max(...trip.map((stopTime) => stopTime.stopSequence));
        expect(row.stopSequence < lastSequence).toBe(true);
        checked += 1;
      }
      if (checked >= 20) break;
    }
    expect(checked > 0).toBe(true);
  });

  it("getScheduledStopTimesForServiceDate returns nothing for an unknown stop or a date without service", async () => {
    const dates = await provider.getServiceDates();
    expect(
      await provider.getScheduledStopTimesForServiceDate("no-such-stop", dates[0] ?? ""),
    ).toEqual([]);
    expect(await provider.getScheduledStopTimesForServiceDate("56939", "19000101")).toEqual([]);
  });

  it("getTrip resolves a known trip and returns undefined for an unknown one", async () => {
    const stopTimes = await provider.getScheduledStopTimesAtStop("56939", NOW - 3600, NOW + 3600);
    const knownTripId = stopTimes[0]?.tripId as string;
    const known = await provider.getTrip(knownTripId);
    expect(known?.id).toBe(knownTripId);

    const unknown = await provider.getTrip("nope:9999999");
    expect(unknown).toBeUndefined();
  });

  it("answers repeated trip lookups with the same data, known or unknown", async () => {
    const stopTimes = await provider.getScheduledStopTimesAtStop("56939", NOW - 3600, NOW + 3600);
    const tripId = stopTimes[0]?.tripId as string;
    expect(await provider.getTrip(tripId)).toEqual(await provider.getTrip(tripId));
    expect(await provider.getTrip("nope:9999999")).toBeUndefined();
    expect(await provider.getTrip("nope:9999999")).toBeUndefined();
  });

  it("keeps trip stop times independent of the service date they were first read with", async () => {
    const stopTimes = await provider.getScheduledStopTimesAtStop("56939", NOW - 3600, NOW + 3600);
    const first = stopTimes[0];
    if (!first) throw new Error("fixture has no stop times near NOW");

    const original = await provider.getScheduledStopTimesForTrip(first.tripId, first.serviceDate);
    const nextDay = await provider.getScheduledStopTimesForTrip(
      first.tripId,
      addDays(first.serviceDate, 1),
    );
    const again = await provider.getScheduledStopTimesForTrip(first.tripId, first.serviceDate);

    expect(nextDay.map((row) => row.stopId)).toEqual(original.map((row) => row.stopId));
    expect(nextDay[0]?.time).not.toBe(original[0]?.time);
    expect(again).toEqual(original);
  });
});

describe("createSqliteCatalogProvider (missing database)", () => {
  it("throws CatalogUnavailableError when the file does not exist", () => {
    let threw: unknown;
    try {
      createSqliteCatalogProvider({ databasePath: "/tmp/does-not-exist-catalog.sqlite" });
    } catch (error) {
      threw = error;
    }
    expect(threw instanceof CatalogUnavailableError).toBe(true);
  });
});
