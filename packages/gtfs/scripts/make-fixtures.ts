/**
 * Generates the test fixtures in `packages/gtfs/test/fixtures/` from the real
 * feed captures in `data/raw/` (git-ignored). See EPIC-001 section 12.
 *
 * Run with `tsx` from anywhere in the repo:
 *   pnpm --filter @transit/gtfs exec tsx scripts/make-fixtures.ts
 *
 * Selection is data only, never logic: one route per feed, everything it
 * references (trips, stop times, stops, shapes, service calendar rows) and
 * every realtime entity for that route.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import { unzipSync } from "fflate";
import gtfsRealtimeBindings from "gtfs-realtime-bindings";

const { FeedMessage } = gtfsRealtimeBindings.transit_realtime;

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_DIR = path.resolve(SCRIPT_DIR, "..");
const REPO_ROOT = path.resolve(PACKAGE_DIR, "..", "..");
const RAW_DIR = path.join(REPO_ROOT, "data", "raw");
const FIXTURES_DIR = path.join(PACKAGE_DIR, "test", "fixtures");

type CsvRow = Record<string, string>;
interface CsvTable {
  header: string[];
  rows: CsvRow[];
}

/** Selection: which single route to keep per feed, and its raw realtime captures. */
const FEEDS: Record<
  string,
  { routeShortName: string; vehiclePositionsRaw: string; tripUpdatesRaw: string }
> = {
  metrotransit: {
    routeShortName: "54",
    vehiclePositionsRaw: "vehicle-positions-2026-09-16T1738.pb",
    tripUpdatesRaw: "trip-updates-2026-09-16T1739.pb",
  },
  mvta: {
    routeShortName: "436",
    vehiclePositionsRaw: "vehicle-positions-2026-09-16T1720.pb",
    tripUpdatesRaw: "trip-updates-2026-09-16T1723.pb",
  },
};

/** Tables copied whole (small, not filtered by route). */
const UNFILTERED_TABLES = ["agency", "feed_info"];

interface RawSource {
  read(tableName: string): string | undefined;
}

function directoryRawSource(dir: string): RawSource {
  return {
    read(tableName) {
      const filePath = path.join(dir, `${tableName}.txt`);
      return existsSync(filePath) ? readFileSync(filePath, "utf8") : undefined;
    },
  };
}

function zipRawSource(zipPath: string): RawSource {
  const entries = unzipSync(readFileSync(zipPath));
  return {
    read(tableName) {
      const bytes = entries[`${tableName}.txt`];
      return bytes ? Buffer.from(bytes).toString("utf8") : undefined;
    },
  };
}

function rawSourceFor(feedId: string): RawSource {
  if (feedId === "metrotransit") {
    return directoryRawSource(path.join(RAW_DIR, "metrotransit", "gtfs"));
  }
  if (feedId === "mvta") {
    return zipRawSource(path.join(RAW_DIR, "mvta", "gtfs.zip"));
  }
  throw new Error(`No raw source configured for feed "${feedId}"`);
}

function headerFromFirstLine(text: string): string[] {
  const firstLine = text.replace(/^﻿/, "").split(/\r?\n/)[0] ?? "";
  return firstLine.split(",").map((column) => column.trim());
}

function parseCsv(text: string): CsvTable {
  const rows = parse(text, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as CsvRow[];
  const header = rows.length > 0 ? Object.keys(rows[0] as CsvRow) : headerFromFirstLine(text);
  return { header, rows };
}

function loadTable(source: RawSource, tableName: string): CsvTable | undefined {
  const text = source.read(tableName);
  return text === undefined ? undefined : parseCsv(text);
}

function requireTable(source: RawSource, feedId: string, tableName: string): CsvTable {
  const table = loadTable(source, tableName);
  if (!table) {
    throw new Error(`Missing required table "${tableName}.txt" for feed "${feedId}"`);
  }
  return table;
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function writeCsvFile(filePath: string, table: CsvTable): void {
  const lines = [table.header.join(",")];
  for (const row of table.rows) {
    lines.push(table.header.map((column) => csvEscape(row[column] ?? "")).join(","));
  }
  writeFileSync(filePath, `${lines.join("\n")}\n`);
}

interface StaticFixtureResult {
  routeIds: Set<string>;
  tripCount: number;
  stopTimeCount: number;
  stopCount: number;
  shapeCount: number;
}

function buildStaticFixture(feedId: string, routeShortName: string): StaticFixtureResult {
  const source = rawSourceFor(feedId);
  const outDir = path.join(FIXTURES_DIR, feedId, "gtfs");
  mkdirSync(outDir, { recursive: true });

  const routes = requireTable(source, feedId, "routes");
  const selectedRoutes = routes.rows.filter((row) => row.route_short_name === routeShortName);
  if (selectedRoutes.length === 0) {
    throw new Error(`No route with short name "${routeShortName}" found for feed "${feedId}"`);
  }
  const routeIds = new Set(selectedRoutes.map((row) => row.route_id));

  const trips = requireTable(source, feedId, "trips");
  const selectedTrips = trips.rows.filter((row) => routeIds.has(row.route_id));
  const tripIds = new Set(selectedTrips.map((row) => row.trip_id));
  const shapeIds = new Set(
    selectedTrips
      .map((row) => row.shape_id)
      .filter((shapeId): shapeId is string => Boolean(shapeId)),
  );
  const serviceIds = new Set(selectedTrips.map((row) => row.service_id));

  const stopTimes = requireTable(source, feedId, "stop_times");
  const selectedStopTimes = stopTimes.rows.filter((row) => tripIds.has(row.trip_id));
  const stopIds = new Set(selectedStopTimes.map((row) => row.stop_id));

  const stops = requireTable(source, feedId, "stops");
  const selectedStops = stops.rows.filter((row) => stopIds.has(row.stop_id));

  const shapes = requireTable(source, feedId, "shapes");
  const selectedShapes = shapes.rows.filter((row) => shapeIds.has(row.shape_id));

  writeCsvFile(path.join(outDir, "routes.txt"), { header: routes.header, rows: selectedRoutes });
  writeCsvFile(path.join(outDir, "trips.txt"), { header: trips.header, rows: selectedTrips });
  writeCsvFile(path.join(outDir, "stop_times.txt"), {
    header: stopTimes.header,
    rows: selectedStopTimes,
  });
  writeCsvFile(path.join(outDir, "stops.txt"), { header: stops.header, rows: selectedStops });
  writeCsvFile(path.join(outDir, "shapes.txt"), { header: shapes.header, rows: selectedShapes });

  for (const tableName of UNFILTERED_TABLES) {
    const table = loadTable(source, tableName);
    if (table) writeCsvFile(path.join(outDir, `${tableName}.txt`), table);
  }

  const calendar = loadTable(source, "calendar");
  if (calendar) {
    const selectedCalendar = calendar.rows.filter((row) => serviceIds.has(row.service_id));
    writeCsvFile(path.join(outDir, "calendar.txt"), {
      header: calendar.header,
      rows: selectedCalendar,
    });
  }

  const calendarDates = loadTable(source, "calendar_dates");
  if (calendarDates) {
    const selectedCalendarDates = calendarDates.rows.filter((row) =>
      serviceIds.has(row.service_id),
    );
    writeCsvFile(path.join(outDir, "calendar_dates.txt"), {
      header: calendarDates.header,
      rows: selectedCalendarDates,
    });
  }

  return {
    routeIds,
    tripCount: selectedTrips.length,
    stopTimeCount: selectedStopTimes.length,
    stopCount: selectedStops.length,
    shapeCount: selectedShapes.length,
  };
}

interface RealtimeFixtureResult {
  totalEntities: number;
  keptEntities: number;
  headerTimestamp: string;
}

function buildRealtimeFixture(
  feedId: string,
  routeIds: Set<string>,
  rawFileName: string,
  outFileName: string,
): RealtimeFixtureResult {
  const rawPath = path.join(RAW_DIR, feedId, rawFileName);
  const message = FeedMessage.decode(readFileSync(rawPath));

  const keptEntities = message.entity.filter((entity) => {
    const trip = entity.vehicle?.trip ?? entity.tripUpdate?.trip;
    return trip?.routeId !== undefined && routeIds.has(trip.routeId);
  });

  const outDir = path.join(FIXTURES_DIR, feedId);
  mkdirSync(outDir, { recursive: true });
  const encoded = FeedMessage.encode({ header: message.header, entity: keptEntities }).finish();
  writeFileSync(path.join(outDir, outFileName), encoded);

  return {
    totalEntities: message.entity.length,
    keptEntities: keptEntities.length,
    headerTimestamp: String(message.header.timestamp),
  };
}

function writeSourceMd(
  feedId: string,
  config: (typeof FEEDS)[string],
  staticResult: StaticFixtureResult,
  vehiclePositions: RealtimeFixtureResult,
  tripUpdates: RealtimeFixtureResult,
): void {
  const routeIds = [...staticResult.routeIds].join(", ");
  const content = `# Fixture source — ${feedId}

Generated by \`packages/gtfs/scripts/make-fixtures.ts\` (EPIC-001 §12) from the local, git-ignored
captures in \`data/raw/${feedId}/\` — see \`data/raw/README.md\` for capture times and origin.
Do not hand-edit; re-run the script instead.

## Selection

Route short name \`${config.routeShortName}\` (route_id: ${routeIds}), data only, no
route-specific logic.

## Static (GTFS)

- Source: \`data/raw/${feedId}/${feedId === "mvta" ? "gtfs.zip" : "gtfs/"}\`
- Kept: ${staticResult.tripCount} trips, ${staticResult.stopTimeCount} stop_times,
  ${staticResult.stopCount} stops, ${staticResult.shapeCount} shape points.
- \`agency.txt\` and \`feed_info.txt\` are copied whole (not filtered).

## Realtime (GTFS-RT)

- \`vehicle-positions.pb\` ← \`${config.vehiclePositionsRaw}\`
  (feed header timestamp ${vehiclePositions.headerTimestamp}); kept ${vehiclePositions.keptEntities}
  of ${vehiclePositions.totalEntities} entities.
- \`trip-updates.pb\` ← \`${config.tripUpdatesRaw}\`
  (feed header timestamp ${tripUpdates.headerTimestamp}); kept ${tripUpdates.keptEntities}
  of ${tripUpdates.totalEntities} entities.
- Entities kept: \`trip.route_id\` in ${routeIds}.
`;
  writeFileSync(path.join(FIXTURES_DIR, feedId, "SOURCE.md"), content);
}

function main(): void {
  for (const [feedId, config] of Object.entries(FEEDS)) {
    const staticResult = buildStaticFixture(feedId, config.routeShortName);
    const vehiclePositions = buildRealtimeFixture(
      feedId,
      staticResult.routeIds,
      config.vehiclePositionsRaw,
      "vehicle-positions.pb",
    );
    const tripUpdates = buildRealtimeFixture(
      feedId,
      staticResult.routeIds,
      config.tripUpdatesRaw,
      "trip-updates.pb",
    );
    writeSourceMd(feedId, config, staticResult, vehiclePositions, tripUpdates);

    console.log(
      `${feedId}: routes=[${[...staticResult.routeIds].join(", ")}] ` +
        `trips=${staticResult.tripCount} stop_times=${staticResult.stopTimeCount} ` +
        `stops=${staticResult.stopCount} shape_points=${staticResult.shapeCount} ` +
        `vehicle-positions=${vehiclePositions.keptEntities}/${vehiclePositions.totalEntities} ` +
        `trip-updates=${tripUpdates.keptEntities}/${tripUpdates.totalEntities}`,
    );
  }
}

main();
