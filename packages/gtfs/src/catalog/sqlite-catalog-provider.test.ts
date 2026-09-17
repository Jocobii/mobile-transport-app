import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { TransitSettings } from "@transit/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildCatalog } from "../static/build-catalog";
import { createDirectoryGtfsSource } from "../static/gtfs-source";
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
  nearbyDefaultRadiusMeters: 500,
  nearbyMinRadiusMeters: 50,
  nearbyMaxRadiusMeters: 2000,
  nearbyMaxStops: 10,
  nearbyFallbackMaxDistanceMeters: 5000,
  nearbyArrivalsPerStop: 3,
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

  it("getTrip resolves a known trip and returns undefined for an unknown one", async () => {
    const stopTimes = await provider.getScheduledStopTimesAtStop("56939", NOW - 3600, NOW + 3600);
    const knownTripId = stopTimes[0]?.tripId as string;
    const known = await provider.getTrip(knownTripId);
    expect(known?.id).toBe(knownTripId);

    const unknown = await provider.getTrip("nope:9999999");
    expect(unknown).toBeUndefined();
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
