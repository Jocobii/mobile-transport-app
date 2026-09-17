import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  DirectionId,
  EpochSeconds,
  FeedConfig,
  LatLon,
  ServiceDate,
  TransitSettings,
} from "@transit/core";
import { addDays, localServiceDate, parseGtfsTime } from "../time/gtfs-time";
import type { GtfsSource } from "./gtfs-source";
import { simplifyShape } from "./simplify-shape";

export interface BuildCatalogFeedInput {
  config: FeedConfig;
  source: GtfsSource;
}

export interface BuildCatalogOptions {
  feeds: BuildCatalogFeedInput[];
  outputPath: string;
  now: EpochSeconds;
  settings: TransitSettings;
}

export interface BuildCatalogFeedSummary {
  feedId: string;
  counts: Record<string, number>;
  durationMs: number;
}

export interface BuildCatalogResult {
  catalogVersion: string;
  outputPath: string;
  feeds: BuildCatalogFeedSummary[];
}

type CsvRow = Record<string, string>;

const WEEKDAY_COLUMNS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const SCHEMA_SQL = `
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE feeds (id TEXT PRIMARY KEY, name TEXT NOT NULL, timezone TEXT NOT NULL, feed_version TEXT, priority INTEGER NOT NULL);
CREATE TABLE agencies (id TEXT PRIMARY KEY, feed_id TEXT NOT NULL, name TEXT NOT NULL);
CREATE TABLE routes (
  id TEXT PRIMARY KEY, feed_id TEXT NOT NULL, agency_id TEXT NOT NULL,
  short_name TEXT NOT NULL, long_name TEXT NOT NULL, color TEXT, text_color TEXT, sort_order INTEGER
);
CREATE TABLE stops (id TEXT PRIMARY KEY, code TEXT NOT NULL, name TEXT NOT NULL, lat REAL NOT NULL, lon REAL NOT NULL);
CREATE TABLE stop_feeds (stop_id TEXT NOT NULL, feed_id TEXT NOT NULL, PRIMARY KEY (stop_id, feed_id));
CREATE TABLE trips (
  id TEXT PRIMARY KEY, feed_id TEXT NOT NULL, route_id TEXT NOT NULL, service_id TEXT NOT NULL,
  direction_id INTEGER NOT NULL, headsign TEXT NOT NULL, shape_id TEXT, pattern_id TEXT NOT NULL
);
CREATE TABLE stop_times (
  trip_id TEXT NOT NULL, stop_sequence INTEGER NOT NULL, stop_id TEXT NOT NULL, time_seconds INTEGER NOT NULL,
  PRIMARY KEY (trip_id, stop_sequence)
) WITHOUT ROWID;
CREATE TABLE service_dates (service_id TEXT NOT NULL, service_date TEXT NOT NULL, PRIMARY KEY (service_id, service_date)) WITHOUT ROWID;
CREATE TABLE route_stops (route_id TEXT NOT NULL, stop_id TEXT NOT NULL, PRIMARY KEY (route_id, stop_id)) WITHOUT ROWID;
CREATE TABLE patterns (id TEXT PRIMARY KEY, route_id TEXT NOT NULL, direction_id INTEGER NOT NULL, headsign TEXT NOT NULL, trip_count INTEGER NOT NULL, shape_json TEXT NOT NULL);
CREATE TABLE pattern_stops (pattern_id TEXT NOT NULL, position INTEGER NOT NULL, stop_id TEXT NOT NULL, PRIMARY KEY (pattern_id, position)) WITHOUT ROWID;
CREATE VIRTUAL TABLE routes_fts USING fts5(route_id UNINDEXED, short_name, long_name, tokenize = 'unicode61 remove_diacritics 2');
CREATE VIRTUAL TABLE stops_fts USING fts5(stop_id UNINDEXED, name, tokenize = 'unicode61 remove_diacritics 2');
`;

const INDEX_SQL = `
CREATE INDEX stops_lat_lon ON stops (lat, lon);
CREATE INDEX trips_route ON trips (route_id, direction_id);
CREATE INDEX stop_times_stop ON stop_times (stop_id);
CREATE INDEX service_dates_date ON service_dates (service_date);
CREATE INDEX route_stops_stop ON route_stops (stop_id);
`;

// ---------------------------------------------------------------------------
// Small parsing helpers
// ---------------------------------------------------------------------------

function optionalNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function optionalInt(value: string | undefined): number | undefined {
  const parsed = optionalNumber(value);
  return parsed === undefined ? undefined : Math.trunc(parsed);
}

function directionIdOf(value: string | undefined): DirectionId {
  return value === "1" ? 1 : 0;
}

async function collectRows(
  source: GtfsSource,
  table: string,
): Promise<CsvRow[]> {
  const rows: CsvRow[] = [];
  for await (const row of source.readRows(table)) rows.push(row);
  return rows;
}

// ---------------------------------------------------------------------------
// 10.2 Service dates
// ---------------------------------------------------------------------------

interface FeedServiceDates {
  /** feed-scoped service id -> set of YYYYMMDD dates it is active on, within the build window. */
  datesByService: Map<string, Set<ServiceDate>>;
  windowStart: ServiceDate;
  windowEnd: ServiceDate;
}

function computeServiceDates(
  feedId: string,
  calendarRows: CsvRow[],
  calendarDateRows: CsvRow[],
  now: EpochSeconds,
  timezone: string,
  settings: TransitSettings,
): FeedServiceDates {
  const buildDate = localServiceDate(now, timezone);
  const windowStart = addDays(buildDate, -settings.catalogServiceDaysBefore);
  const windowEnd = addDays(buildDate, settings.catalogServiceDaysAfter);

  const calendarByService = new Map<string, CsvRow>();
  for (const row of calendarRows)
    calendarByService.set(row.service_id as string, row);

  const exceptionsByService = new Map<string, Map<ServiceDate, "1" | "2">>();
  for (const row of calendarDateRows) {
    const serviceId = row.service_id as string;
    const exceptions =
      exceptionsByService.get(serviceId) ?? new Map<ServiceDate, "1" | "2">();
    if (row.exception_type === "1" || row.exception_type === "2") {
      exceptions.set(row.date as string, row.exception_type);
    }
    exceptionsByService.set(serviceId, exceptions);
  }

  const serviceIds = new Set<string>([
    ...calendarByService.keys(),
    ...exceptionsByService.keys(),
  ]);
  const datesByService = new Map<string, Set<ServiceDate>>();

  const dates: ServiceDate[] = [];
  for (let d = windowStart; d <= windowEnd; d = addDays(d, 1)) dates.push(d);

  for (const date of dates) {
    const isoDate = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T00:00:00Z`;
    const weekday = WEEKDAY_COLUMNS[new Date(isoDate).getUTCDay()] as string;
    for (const serviceId of serviceIds) {
      const calendarRow = calendarByService.get(serviceId);
      let active = false;
      if (
        calendarRow &&
        (calendarRow.start_date as string) <= date &&
        date <= (calendarRow.end_date as string) &&
        calendarRow[weekday] === "1"
      ) {
        active = true;
      }
      const exception = exceptionsByService.get(serviceId)?.get(date);
      if (exception === "1") active = true;
      if (exception === "2") active = false;

      if (active) {
        const scopedId = `${feedId}:${serviceId}`;
        const activeDates =
          datesByService.get(scopedId) ?? new Set<ServiceDate>();
        activeDates.add(date);
        datesByService.set(scopedId, activeDates);
      }
    }
  }

  return { datesByService, windowStart, windowEnd };
}

// ---------------------------------------------------------------------------
// 10.3 Stops
// ---------------------------------------------------------------------------

interface StopRecord {
  code: string;
  name: string;
  lat: number;
  lon: number;
}

function importableStops(rows: CsvRow[]): Map<string, StopRecord> {
  const result = new Map<string, StopRecord>();
  for (const row of rows) {
    const locationType = (row.location_type ?? "").trim();
    if (locationType !== "" && locationType !== "0") continue;

    const lat = optionalNumber(row.stop_lat);
    const lon = optionalNumber(row.stop_lon);
    if (lat === undefined || lon === undefined) continue;
    if (lat === 0 && lon === 0) continue;

    const stopId = row.stop_id as string;
    const code =
      row.stop_code && row.stop_code.trim() !== "" ? row.stop_code : stopId;
    result.set(stopId, { code, name: row.stop_name ?? "", lat, lon });
  }
  return result;
}

// ---------------------------------------------------------------------------
// 10.4 Stop times (interpolation)
// ---------------------------------------------------------------------------

interface RawStopTime {
  stopSequence: number;
  stopId: string;
  timeSeconds: number | null;
  shapeDistTraveled: number | null;
}

interface ResolvedStopTime {
  stopSequence: number;
  stopId: string;
  timeSeconds: number;
}

function resolveStopTimes(rows: RawStopTime[]): ResolvedStopTime[] {
  const resolved = rows.map((row) => ({ ...row }));

  for (let i = 0; i < resolved.length; i++) {
    const current = resolved[i] as RawStopTime;
    if (current.timeSeconds !== null) continue;

    let p = i - 1;
    while (p >= 0 && (resolved[p] as RawStopTime).timeSeconds === null) p--;
    let n = i + 1;
    while (
      n < resolved.length &&
      (resolved[n] as RawStopTime).timeSeconds === null
    )
      n++;
    if (p < 0 || n >= resolved.length) continue;

    const prev = resolved[p] as RawStopTime;
    const next = resolved[n] as RawStopTime;
    const prevTime = prev.timeSeconds as number;
    const nextTime = next.timeSeconds as number;

    let fraction: number;
    if (
      prev.shapeDistTraveled !== null &&
      next.shapeDistTraveled !== null &&
      current.shapeDistTraveled !== null &&
      next.shapeDistTraveled !== prev.shapeDistTraveled
    ) {
      fraction =
        (current.shapeDistTraveled - prev.shapeDistTraveled) /
        (next.shapeDistTraveled - prev.shapeDistTraveled);
    } else {
      fraction = (i - p) / (n - p);
    }

    current.timeSeconds = Math.round(
      prevTime + fraction * (nextTime - prevTime),
    );
  }

  return resolved
    .filter(
      (row): row is RawStopTime & { timeSeconds: number } =>
        row.timeSeconds !== null,
    )
    .map((row) => ({
      stopSequence: row.stopSequence,
      stopId: row.stopId,
      timeSeconds: row.timeSeconds,
    }));
}

// ---------------------------------------------------------------------------
// One feed's import
// ---------------------------------------------------------------------------

interface ImportedTrip {
  id: string;
  routeId: string;
  directionId: DirectionId;
  headsign: string;
  shapeId?: string;
  stopTimes: ResolvedStopTime[];
  serviceDates: Set<ServiceDate>;
}

interface FeedImportResult {
  counts: Record<string, number>;
  feedVersion?: string;
  windowStart: ServiceDate;
  windowEnd: ServiceDate;
}

async function importFeed(
  db: DatabaseSync,
  { config, source }: BuildCatalogFeedInput,
  priority: number,
  now: EpochSeconds,
  settings: TransitSettings,
  globalStops: Map<string, StopRecord>,
  stopFeedPairs: Array<{ stopId: string; feedId: string }>,
): Promise<FeedImportResult> {
  const feedId = config.id;
  const counts: Record<string, number> = {};

  const [
    agencyRows,
    routeRows,
    stopRows,
    tripRows,
    stopTimeRows,
    calendarRows,
    calendarDateRows,
    shapeRows,
    feedInfoRows,
  ] = await Promise.all([
    collectRows(source, "agency"),
    collectRows(source, "routes"),
    collectRows(source, "stops"),
    collectRows(source, "trips"),
    collectRows(source, "stop_times"),
    collectRows(source, "calendar"),
    collectRows(source, "calendar_dates"),
    collectRows(source, "shapes"),
    collectRows(source, "feed_info"),
  ]);

  db.prepare(
    "INSERT INTO feeds (id, name, timezone, feed_version, priority) VALUES (?, ?, ?, ?, ?)",
  ).run(
    feedId,
    config.name,
    config.timezone,
    feedInfoRows[0]?.feed_version ?? null,
    priority,
  );

  // --- agencies -------------------------------------------------------------
  const insertAgency = db.prepare(
    "INSERT INTO agencies (id, feed_id, name) VALUES (?, ?, ?)",
  );
  for (const row of agencyRows) {
    insertAgency.run(
      `${feedId}:${row.agency_id ?? ""}`,
      feedId,
      row.agency_name ?? "",
    );
  }
  counts.agencies = agencyRows.length;
  const defaultAgencyId =
    agencyRows.length === 1 ? (agencyRows[0]?.agency_id ?? "") : "default";

  // --- routes -----------------------------------------------------------------
  const insertRoute = db.prepare(
    "INSERT INTO routes " +
      "(id, feed_id, agency_id, short_name, long_name, color, text_color, sort_order) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertRouteFts = db.prepare(
    "INSERT INTO routes_fts (route_id, short_name, long_name) VALUES (?, ?, ?)",
  );
  for (const row of routeRows) {
    const routeId = `${feedId}:${row.route_id}`;
    const rawAgencyId =
      row.agency_id && row.agency_id.trim() !== ""
        ? row.agency_id
        : defaultAgencyId;
    const shortName = row.route_short_name ?? "";
    const longName = row.route_long_name ?? "";
    insertRoute.run(
      routeId,
      feedId,
      `${feedId}:${rawAgencyId}`,
      shortName,
      longName,
      row.route_color || null,
      row.route_text_color || null,
      optionalInt(row.route_sort_order) ?? null,
    );
    insertRouteFts.run(routeId, shortName, longName);
  }
  counts.routes = routeRows.length;

  // --- stops (10.3) -------------------------------------------------------------
  const feedStops = importableStops(stopRows);
  for (const [stopId, record] of feedStops) {
    if (!globalStops.has(stopId)) globalStops.set(stopId, record);
    stopFeedPairs.push({ stopId, feedId });
  }
  counts.stops = feedStops.size;

  // --- service dates (10.2) ----------------------------------------------------
  const { datesByService, windowStart, windowEnd } = computeServiceDates(
    feedId,
    calendarRows,
    calendarDateRows,
    now,
    config.timezone,
    settings,
  );
  const insertServiceDate = db.prepare(
    "INSERT INTO service_dates (service_id, service_date) VALUES (?, ?)",
  );
  let serviceDateCount = 0;
  for (const [serviceId, dates] of datesByService) {
    for (const date of dates) {
      insertServiceDate.run(serviceId, date);
      serviceDateCount++;
    }
  }
  counts.service_dates = serviceDateCount;

  // --- shapes (kept only in memory, for patterns) -------------------------------
  const rawShapePoints = new Map<
    string,
    Array<{ lat: number; lon: number; seq: number }>
  >();
  for (const row of shapeRows) {
    const shapeId = `${feedId}:${row.shape_id}`;
    const list = rawShapePoints.get(shapeId) ?? [];
    list.push({
      lat: Number(row.shape_pt_lat),
      lon: Number(row.shape_pt_lon),
      seq: Number(row.shape_pt_sequence),
    });
    rawShapePoints.set(shapeId, list);
  }
  const shapePoints = new Map<string, LatLon[]>();
  for (const [shapeId, points] of rawShapePoints) {
    points.sort((a, b) => a.seq - b.seq);
    shapePoints.set(
      shapeId,
      points.map((point) => ({ lat: point.lat, lon: point.lon })),
    );
  }

  // --- trips + stop_times (10.4) ------------------------------------------------
  const stopTimesByTrip = new Map<string, RawStopTime[]>();
  for (const [index, row] of stopTimeRows.entries()) {
    const tripId = row.trip_id as string;
    const list = stopTimesByTrip.get(tripId) ?? [];
    const timeRaw =
      row.departure_time?.trim() || row.arrival_time?.trim() || "";
    list.push({
      stopSequence: Number(row.stop_sequence),
      stopId: row.stop_id as string,
      timeSeconds:
        timeRaw === ""
          ? null
          : parseGtfsTime(timeRaw, { file: "stop_times.txt", row: index + 2 }),
      shapeDistTraveled: optionalNumber(row.shape_dist_traveled) ?? null,
    });
    stopTimesByTrip.set(tripId, list);
  }

  const buildDate = localServiceDate(now, config.timezone);

  const importedTrips: ImportedTrip[] = [];
  const routeStops = new Map<string, Set<string>>();

  const insertTrip = db.prepare(
    "INSERT INTO trips " +
      "(id, feed_id, route_id, service_id, direction_id, headsign, shape_id, pattern_id) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertStopTime = db.prepare(
    "INSERT INTO stop_times (trip_id, stop_sequence, stop_id, time_seconds) VALUES (?, ?, ?, ?)",
  );

  for (const row of tripRows) {
    const scopedServiceId = `${feedId}:${row.service_id}`;
    const serviceDates = datesByService.get(scopedServiceId);
    if (!serviceDates || serviceDates.size === 0) continue;

    const rawStopTimes = (stopTimesByTrip.get(row.trip_id as string) ?? [])
      .filter((st) => feedStops.has(st.stopId))
      .sort((a, b) => a.stopSequence - b.stopSequence);
    const stopTimes = resolveStopTimes(rawStopTimes);
    if (stopTimes.length < 2) continue;

    const routeId = `${feedId}:${row.route_id}`;
    const directionId = directionIdOf(row.direction_id);
    const patternId = `${routeId}:${directionId}`;
    const tripId = `${feedId}:${row.trip_id}`;
    const shapeId =
      row.shape_id && row.shape_id.trim() !== ""
        ? `${feedId}:${row.shape_id}`
        : undefined;
    const headsign = row.trip_headsign ?? "";

    insertTrip.run(
      tripId,
      feedId,
      routeId,
      scopedServiceId,
      directionId,
      headsign,
      shapeId ?? null,
      patternId,
    );
    const stopIdsForRoute = routeStops.get(routeId) ?? new Set<string>();
    for (const st of stopTimes) {
      insertStopTime.run(tripId, st.stopSequence, st.stopId, st.timeSeconds);
      stopIdsForRoute.add(st.stopId);
    }
    routeStops.set(routeId, stopIdsForRoute);

    importedTrips.push({
      id: tripId,
      routeId,
      directionId,
      headsign,
      shapeId,
      stopTimes,
      serviceDates,
    });
  }
  counts.trips = importedTrips.length;

  const insertRouteStop = db.prepare(
    "INSERT OR IGNORE INTO route_stops (route_id, stop_id) VALUES (?, ?)",
  );
  let routeStopCount = 0;
  for (const [routeId, stopIds] of routeStops) {
    for (const stopId of stopIds) {
      insertRouteStop.run(routeId, stopId);
      routeStopCount++;
    }
  }
  counts.route_stops = routeStopCount;

  // --- representative patterns (10.5) --------------------------------------------
  const lookaheadEnd = addDays(buildDate, settings.patternLookaheadDays);
  counts.patterns = buildPatterns(
    db,
    importedTrips,
    buildDate,
    lookaheadEnd,
    settings,
    globalStops,
    shapePoints,
  );

  return {
    counts,
    feedVersion: feedInfoRows[0]?.feed_version,
    windowStart,
    windowEnd,
  };
}

// ---------------------------------------------------------------------------
// 10.5 Representative pattern per route and direction
// ---------------------------------------------------------------------------

function groupByRouteAndDirection(
  trips: ImportedTrip[],
): Map<string, Map<DirectionId, ImportedTrip[]>> {
  const byRoute = new Map<string, Map<DirectionId, ImportedTrip[]>>();
  for (const trip of trips) {
    const byDirection =
      byRoute.get(trip.routeId) ?? new Map<DirectionId, ImportedTrip[]>();
    const list = byDirection.get(trip.directionId) ?? [];
    list.push(trip);
    byDirection.set(trip.directionId, list);
    byRoute.set(trip.routeId, byDirection);
  }
  return byRoute;
}

function pickWinningGroup(
  groups: Map<string, ImportedTrip[]>,
): ImportedTrip[] | undefined {
  let winner: ImportedTrip[] | undefined;
  for (const group of groups.values()) {
    if (!winner) {
      winner = group;
      continue;
    }
    const groupStops = (group[0] as ImportedTrip).stopTimes.length;
    const winnerStops = (winner[0] as ImportedTrip).stopTimes.length;
    const groupFirstId = [...group].map((t) => t.id).sort()[0] as string;
    const winnerFirstId = [...winner].map((t) => t.id).sort()[0] as string;
    const better =
      group.length > winner.length ||
      (group.length === winner.length && groupStops > winnerStops) ||
      (group.length === winner.length &&
        groupStops === winnerStops &&
        groupFirstId < winnerFirstId);
    if (better) winner = group;
  }
  return winner;
}

function pickHeadsign(
  winner: ImportedTrip[],
  stopIds: string[],
  stopById: Map<string, StopRecord>,
): string {
  const counts = new Map<string, number>();
  for (const trip of winner)
    counts.set(trip.headsign, (counts.get(trip.headsign) ?? 0) + 1);

  let headsign = "";
  let bestCount = -1;
  for (const [candidate, count] of [...counts.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    if (count > bestCount) {
      headsign = candidate;
      bestCount = count;
    }
  }
  if (headsign.trim() !== "") return headsign;

  const lastStopId = stopIds[stopIds.length - 1] as string;
  return stopById.get(lastStopId)?.name ?? "";
}

function pickShape(
  winner: ImportedTrip[],
  stopIds: string[],
  stopById: Map<string, StopRecord>,
  shapePoints: Map<string, LatLon[]>,
  toleranceMeters: number,
): LatLon[] {
  const shapeIdCounts = new Map<string, number>();
  for (const trip of winner) {
    if (trip.shapeId)
      shapeIdCounts.set(
        trip.shapeId,
        (shapeIdCounts.get(trip.shapeId) ?? 0) + 1,
      );
  }
  let bestShapeId: string | undefined;
  let bestShapeCount = 0;
  for (const [shapeId, count] of shapeIdCounts) {
    if (count > bestShapeCount) {
      bestShapeId = shapeId;
      bestShapeCount = count;
    }
  }
  const rawShape =
    (bestShapeId ? shapePoints.get(bestShapeId) : undefined) ??
    stopIds.map((stopId) => {
      const stop = stopById.get(stopId);
      return { lat: stop?.lat ?? 0, lon: stop?.lon ?? 0 };
    });
  return simplifyShape(rawShape, toleranceMeters);
}

function buildPatterns(
  db: DatabaseSync,
  trips: ImportedTrip[],
  buildDate: ServiceDate,
  lookaheadEnd: ServiceDate,
  settings: TransitSettings,
  stopById: Map<string, StopRecord>,
  shapePoints: Map<string, LatLon[]>,
): number {
  const insertPattern = db.prepare(
    "INSERT INTO patterns (id, route_id, direction_id, headsign, trip_count, shape_json) " +
      "VALUES (?, ?, ?, ?, ?, ?)",
  );
  const insertPatternStop = db.prepare(
    "INSERT INTO pattern_stops (pattern_id, position, stop_id) VALUES (?, ?, ?)",
  );

  let patternCount = 0;
  for (const [routeId, byDirection] of groupByRouteAndDirection(trips)) {
    for (const [directionId, groupTrips] of byDirection) {
      const lookaheadTrips = groupTrips.filter((trip) =>
        [...trip.serviceDates].some(
          (date) => date >= buildDate && date <= lookaheadEnd,
        ),
      );
      const pool = lookaheadTrips.length > 0 ? lookaheadTrips : groupTrips;

      const stopSequenceGroups = new Map<string, ImportedTrip[]>();
      for (const trip of pool) {
        const stopKey = trip.stopTimes.map((st) => st.stopId).join("|");
        const list = stopSequenceGroups.get(stopKey) ?? [];
        list.push(trip);
        stopSequenceGroups.set(stopKey, list);
      }

      const winner = pickWinningGroup(stopSequenceGroups);
      if (!winner) continue;

      const representative = winner[0] as ImportedTrip;
      const stopIds = representative.stopTimes.map((st) => st.stopId);
      const headsign = pickHeadsign(winner, stopIds, stopById);
      const shape = pickShape(
        winner,
        stopIds,
        stopById,
        shapePoints,
        settings.shapeSimplifyToleranceMeters,
      );

      const patternId = `${routeId}:${directionId}`;
      insertPattern.run(
        patternId,
        routeId,
        directionId,
        headsign,
        winner.length,
        JSON.stringify(shape),
      );
      stopIds.forEach((stopId, position) =>
        insertPatternStop.run(patternId, position, stopId),
      );
      patternCount++;
    }
  }
  return patternCount;
}

export async function buildCatalog(
  options: BuildCatalogOptions,
): Promise<BuildCatalogResult> {
  const { feeds, outputPath, now, settings } = options;
  const tmpPath = `${outputPath}.tmp`;

  mkdirSync(path.dirname(outputPath), { recursive: true });
  if (existsSync(tmpPath)) rmSync(tmpPath);
  if (existsSync(outputPath)) rmSync(outputPath);

  const db = new DatabaseSync(tmpPath);
  db.exec("PRAGMA journal_mode = OFF");
  db.exec("PRAGMA synchronous = OFF");
  db.exec(SCHEMA_SQL);

  const globalStops = new Map<string, StopRecord>();
  const stopFeedPairs: Array<{ stopId: string; feedId: string }> = [];
  const feedSummaries: BuildCatalogFeedSummary[] = [];
  const feedVersionParts: string[] = [];
  let windowStart: ServiceDate | undefined;
  let windowEnd: ServiceDate | undefined;

  db.exec("BEGIN");
  try {
    let priority = 0;
    for (const feed of feeds) {
      const startedAt = Date.now();
      const result = await importFeed(
        db,
        feed,
        priority,
        now,
        settings,
        globalStops,
        stopFeedPairs,
      );
      feedSummaries.push({
        feedId: feed.config.id,
        counts: result.counts,
        durationMs: Date.now() - startedAt,
      });
      feedVersionParts.push(
        `${feed.config.id}=${result.feedVersion ?? "unknown"}`,
      );
      if (windowStart === undefined || result.windowStart < windowStart)
        windowStart = result.windowStart;
      if (windowEnd === undefined || result.windowEnd > windowEnd)
        windowEnd = result.windowEnd;
      priority++;
    }

    const insertStop = db.prepare(
      "INSERT INTO stops (id, code, name, lat, lon) VALUES (?, ?, ?, ?, ?)",
    );
    const insertStopFts = db.prepare(
      "INSERT INTO stops_fts (stop_id, name) VALUES (?, ?)",
    );
    for (const [stopId, record] of globalStops) {
      insertStop.run(stopId, record.code, record.name, record.lat, record.lon);
      insertStopFts.run(stopId, record.name);
    }
    const insertStopFeed = db.prepare(
      "INSERT INTO stop_feeds (stop_id, feed_id) VALUES (?, ?)",
    );
    for (const pair of stopFeedPairs)
      insertStopFeed.run(pair.stopId, pair.feedId);

    const catalogVersion = `${new Date(now * 1000).toISOString()}|${feedVersionParts.join(",")}`;
    const insertMeta = db.prepare(
      "INSERT INTO meta (key, value) VALUES (?, ?)",
    );
    insertMeta.run("catalog_version", catalogVersion);
    insertMeta.run("built_at", String(now));
    insertMeta.run("service_window_start", windowStart ?? "");
    insertMeta.run("service_window_end", windowEnd ?? "");

    db.exec("COMMIT");
    db.exec(INDEX_SQL);
    db.close();

    renameSync(tmpPath, outputPath);

    return { catalogVersion, outputPath, feeds: feedSummaries };
  } catch (error) {
    db.exec("ROLLBACK");
    db.close();
    if (existsSync(tmpPath)) rmSync(tmpPath);
    throw error;
  }
}
