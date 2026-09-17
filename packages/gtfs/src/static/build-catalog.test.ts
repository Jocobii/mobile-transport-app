import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TransitSettings } from "@transit/core";
import { buildCatalog } from "./build-catalog";
import { createDirectoryGtfsSource } from "./gtfs-source";

const FIXTURES_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "test/fixtures",
);

const NOW = 1789597408;

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

describe("buildCatalog (real fixtures: metrotransit + mvta)", () => {
  let tmpDir: string;
  let outputPath: string;
  let db: DatabaseSync;

  beforeAll(async () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "catalog-test-"));
    outputPath = path.join(tmpDir, "catalog.sqlite");

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

    db = new DatabaseSync(outputPath, { readOnly: true });
  });

  afterAll(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("materializes service dates from calendar.txt and calendar_dates.txt", () => {
    // metrotransit service 18 (calendar.txt: mon-fri) is overridden off on 20261014-20261016
    // by calendar_dates.txt exception_type=2, and stays active on other weekdays in range.
    const active = db
      .prepare("SELECT service_date FROM service_dates WHERE service_id = ?")
      .all("metrotransit:18") as Array<{ service_date: string }>;
    expect(active.length).toBeGreaterThan(0);
    expect(active.some((row) => row.service_date === "20260916")).toBe(true);
  });

  it("keeps the shared stop 56939 once, with both feeds listed and Metro Transit's name", () => {
    const stop = db.prepare("SELECT * FROM stops WHERE id = ?").get("56939") as
      | { id: string; name: string; lat: number; lon: number }
      | undefined;
    expect(stop).toBeDefined();
    expect(stop?.name).toBe("MSP Terminal 1 Transit Station");

    const feeds = db
      .prepare("SELECT feed_id FROM stop_feeds WHERE stop_id = ? ORDER BY feed_id")
      .all("56939") as Array<{ feed_id: string }>;
    expect(feeds.map((row) => row.feed_id)).toEqual(["metrotransit", "mvta"]);
  });

  it("stores a trip time >= 24:00:00 as seconds > 86400", () => {
    const overnight = db
      .prepare("SELECT time_seconds FROM stop_times WHERE time_seconds >= 86400 LIMIT 1")
      .get() as { time_seconds: number } | undefined;
    expect(overnight).toBeDefined();
    expect(overnight?.time_seconds).toBeGreaterThan(86400);
  });

  it("builds the mvta:436 direction 1 pattern ending at Eagan Transit Station", () => {
    const pattern = db
      .prepare("SELECT id FROM patterns WHERE route_id = ? AND direction_id = 1")
      .get("mvta:436") as { id: string } | undefined;
    expect(pattern).toBeDefined();

    const lastStop = db
      .prepare(
        "SELECT s.name FROM pattern_stops ps JOIN stops s ON s.id = ps.stop_id " +
          "WHERE ps.pattern_id = ? ORDER BY ps.position DESC LIMIT 1",
      )
      .get(pattern?.id) as { name: string } | undefined;
    expect(lastStop?.name).toBe("Eagan Transit Station");
  });
});

describe("buildCatalog (synthetic fixture: non-boarding stops and interpolation)", () => {
  let sourceDir: string;
  let tmpDir: string;
  let outputPath: string;
  let db: DatabaseSync;

  beforeAll(async () => {
    sourceDir = mkdtempSync(path.join(tmpdir(), "catalog-synthetic-src-"));
    writeFileSync(
      path.join(sourceDir, "agency.txt"),
      "agency_id,agency_name,agency_url,agency_timezone\n" +
        "1,Synthetic Agency,http://example.com,America/Chicago\n",
    );
    writeFileSync(
      path.join(sourceDir, "routes.txt"),
      "route_id,agency_id,route_short_name,route_long_name\nR1,1,1,Test Route\n",
    );
    writeFileSync(
      path.join(sourceDir, "stops.txt"),
      [
        "stop_id,stop_name,stop_lat,stop_lon,location_type",
        "S1,Stop One,44.9,-93.2,0",
        "S3,Station Entrance,44.92,-93.22,1",
        "S2,Stop Two,44.91,-93.21,0",
        "S4,Stop Four,44.93,-93.23,0",
        "",
      ].join("\n"),
    );
    writeFileSync(
      path.join(sourceDir, "trips.txt"),
      "route_id,service_id,trip_id,trip_headsign,direction_id\nR1,WK,T1,Downtown,0\n",
    );
    writeFileSync(
      path.join(sourceDir, "stop_times.txt"),
      [
        "trip_id,stop_sequence,stop_id,arrival_time,departure_time",
        "T1,1,S1,08:00:00,08:00:00",
        "T1,2,S3,08:05:00,08:05:00",
        "T1,3,S2,,",
        "T1,4,S4,08:10:00,08:10:00",
        "",
      ].join("\n"),
    );
    writeFileSync(
      path.join(sourceDir, "calendar.txt"),
      "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\n" +
        "WK,1,1,1,1,1,0,0,20260101,20261231\n",
    );

    tmpDir = mkdtempSync(path.join(tmpdir(), "catalog-synthetic-out-"));
    outputPath = path.join(tmpDir, "catalog.sqlite");

    await buildCatalog({
      outputPath,
      now: NOW,
      settings: TEST_SETTINGS,
      feeds: [
        {
          config: {
            id: "synthetic",
            name: "Synthetic",
            timezone: "America/Chicago",
            staticUrl: "",
            vehiclePositionsUrl: "",
            tripUpdatesUrl: "",
          },
          source: createDirectoryGtfsSource(sourceDir),
        },
      ],
    });

    db = new DatabaseSync(outputPath, { readOnly: true });
  });

  afterAll(() => {
    db.close();
    rmSync(sourceDir, { recursive: true, force: true });
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("does not import a stop with location_type != 0", () => {
    const stop = db.prepare("SELECT id FROM stops WHERE id = ?").get("S3");
    expect(stop).toBeUndefined();
  });

  it("interpolates a blank stop time between its known neighbors", () => {
    const rows = db
      .prepare(
        "SELECT stop_id, time_seconds FROM stop_times WHERE trip_id = ? ORDER BY stop_sequence",
      )
      .all("synthetic:T1") as Array<{ stop_id: string; time_seconds: number }>;

    // The non-boarding stop S3 is dropped entirely, leaving S1, S2, S4.
    expect(rows.map((row) => row.stop_id)).toEqual(["S1", "S2", "S4"]);
    expect(rows[0]?.time_seconds).toBe(8 * 3600);
    expect(rows[2]?.time_seconds).toBe(8 * 3600 + 10 * 60);
    // Interpolated halfway (by position) between 08:00:00 and 08:10:00.
    expect(rows[1]?.time_seconds).toBe(8 * 3600 + 5 * 60);
  });
});
