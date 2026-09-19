import { DatabaseSync } from "node:sqlite";
import type {
  Bounds,
  CatalogProvider,
  EpochSeconds,
  LatLon,
  Route,
  RouteId,
  RoutePattern,
  ScheduledStopTime,
  ServiceDate,
  Stop,
  StopId,
  StopWithDistance,
  Trip,
  TripId,
} from "@transit/core";
import { boundingBox, boundsCenter, haversineMeters, VARIANT_SUFFIX_PATTERN } from "@transit/core";
import { addDays, epochFor, localServiceDate } from "../time/gtfs-time";

export class CatalogUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "CatalogUnavailableError";
  }
}

export interface SqliteCatalogProviderOptions {
  databasePath: string;
}

type Row = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function escapeFtsTerm(word: string): string {
  return word.replace(/"/g, "");
}

/** `word1* OR word2* ...` (quoted-prefix syntax), for matching any query word. */
function ftsPrefixOr(column: string, words: string[]): string | undefined {
  if (words.length === 0) return undefined;
  const terms = words.map((word) => `"${escapeFtsTerm(word)}"*`).join(" OR ");
  return `${column} : (${terms})`;
}

/** `word1* AND word2* ...` (quoted-prefix syntax), requiring every query word. */
function ftsPrefixAnd(column: string, words: string[]): string | undefined {
  if (words.length === 0) return undefined;
  const terms = words.map((word) => `"${escapeFtsTerm(word)}"*`).join(" AND ");
  return `${column} : (${terms})`;
}

const NATURAL_COLLATOR = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

function datesBetween(start: ServiceDate, end: ServiceDate): ServiceDate[] {
  const dates: ServiceDate[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) dates.push(d);
  return dates;
}

function toRoute(row: Row): Route {
  return {
    id: row.id as string,
    feedId: row.feed_id as string,
    agencyId: row.agency_id as string,
    shortName: row.short_name as string,
    longName: row.long_name as string,
    color: (row.color as string | null) ?? undefined,
    textColor: (row.text_color as string | null) ?? undefined,
    sortOrder: (row.sort_order as number | null) ?? undefined,
  };
}

function compareRoutesForSearch(
  a: { route: Route; score: number },
  b: { route: Route; score: number },
): number {
  if (a.score !== b.score) return b.score - a.score;
  const aOrder = a.route.sortOrder;
  const bOrder = b.route.sortOrder;
  if (aOrder !== undefined && bOrder !== undefined && aOrder !== bOrder) return aOrder - bOrder;
  if (aOrder !== undefined && bOrder === undefined) return -1;
  if (aOrder === undefined && bOrder !== undefined) return 1;
  const byShortName = NATURAL_COLLATOR.compare(a.route.shortName, b.route.shortName);
  if (byShortName !== 0) return byShortName;
  return NATURAL_COLLATOR.compare(a.route.longName, b.route.longName);
}

function compareStopsForSearch(
  a: { stop: Stop; score: number },
  b: { stop: Stop; score: number },
): number {
  if (a.score !== b.score) return b.score - a.score;
  return NATURAL_COLLATOR.compare(a.stop.name, b.stop.name);
}

export function createSqliteCatalogProvider(
  options: SqliteCatalogProviderOptions,
): CatalogProvider {
  let db: DatabaseSync;
  try {
    db = new DatabaseSync(options.databasePath, { readOnly: true });
  } catch (error) {
    throw new CatalogUnavailableError(
      `Catalog database is unavailable at ${options.databasePath}`,
      { cause: error },
    );
  }

  const feedsCache = db.prepare("SELECT id, timezone FROM feeds").all() as Array<{
    id: string;
    timezone: string;
  }>;

  const stmtCatalogVersion = db.prepare("SELECT value FROM meta WHERE key = 'catalog_version'");
  const stmtGetStop = db.prepare("SELECT * FROM stops WHERE id = ?");
  const stmtStopFeeds = db.prepare(
    "SELECT feed_id FROM stop_feeds WHERE stop_id = ? ORDER BY feed_id",
  );
  const stmtStopsInBox = db.prepare(
    "SELECT * FROM stops WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?",
  );
  const stmtRouteExact = db.prepare("SELECT * FROM routes WHERE lower(short_name) = ?");
  const stmtRouteStartsWith = db.prepare(
    "SELECT * FROM routes WHERE short_name != '' AND lower(short_name) LIKE ? || '%'",
  );
  const stmtRoutesFts = db.prepare(
    "SELECT DISTINCT route_id FROM routes_fts WHERE routes_fts MATCH ?",
  );
  const stmtRouteById = db.prepare("SELECT * FROM routes WHERE id = ?");
  const stmtStopExact = db.prepare("SELECT * FROM stops WHERE lower(code) = ?");
  const stmtStopsFts = db.prepare("SELECT DISTINCT stop_id FROM stops_fts WHERE stops_fts MATCH ?");
  const stmtStopById = db.prepare("SELECT * FROM stops WHERE id = ?");
  const stmtRoutesServingStop = db.prepare(
    "SELECT r.* FROM route_stops rs JOIN routes r ON r.id = rs.route_id WHERE rs.stop_id = ?",
  );
  const stmtGetTrip = db.prepare("SELECT * FROM trips WHERE id = ?");
  const stmtPatterns = db.prepare(
    "SELECT * FROM patterns WHERE route_id = ? ORDER BY direction_id",
  );
  const stmtPatternStops = db.prepare(
    "SELECT s.* FROM pattern_stops ps JOIN stops s ON s.id = ps.stop_id " +
      "WHERE ps.pattern_id = ? ORDER BY ps.position",
  );
  const stmtStopTimesForTrip = db.prepare(
    "SELECT stop_sequence, stop_id, time_seconds FROM stop_times " +
      "WHERE trip_id = ? ORDER BY stop_sequence",
  );
  const stmtStopTimesAtStopForFeed = db.prepare(
    `SELECT st.trip_id AS tripId, st.stop_sequence AS stopSequence, st.time_seconds AS timeSeconds,
            t.route_id AS routeId, t.direction_id AS directionId, t.headsign AS headsign,
            sd.service_date AS serviceDate
     FROM stop_times st
     JOIN trips t ON t.id = st.trip_id
     JOIN service_dates sd ON sd.service_id = t.service_id
     WHERE st.stop_id = ? AND t.feed_id = ?`,
  );

  // Why EXISTS: a trip that ends at this stop has no later stop_sequence; nobody boards there,
  // so it does not belong in a departure timetable (generic GTFS rule, per stop_sequence).
  const stmtDeparturesAtStopForDate = db.prepare(
    `SELECT st.stop_sequence AS stopSequence, st.trip_id AS tripId, st.time_seconds AS timeSeconds,
            t.feed_id AS feedId, t.route_id AS routeId, t.direction_id AS directionId,
            t.headsign AS headsign
     FROM stop_times st
     JOIN trips t ON t.id = st.trip_id
     JOIN service_dates sd ON sd.service_id = t.service_id
     WHERE st.stop_id = ? AND sd.service_date = ?
       AND EXISTS (
         SELECT 1 FROM stop_times nx WHERE nx.trip_id = st.trip_id AND nx.stop_sequence > st.stop_sequence
       )`,
  );
  const stmtServiceDates = db.prepare(
    "SELECT DISTINCT service_date FROM service_dates ORDER BY service_date",
  );

  function stopFeedIds(stopId: StopId): string[] {
    const rows = stmtStopFeeds.all(stopId) as Array<{ feed_id: string }>;
    return rows.map((row) => row.feed_id);
  }

  function toStop(row: Row): Stop {
    const id = row.id as string;
    return {
      id,
      code: row.code as string,
      name: row.name as string,
      lat: row.lat as number,
      lon: row.lon as number,
      feedIds: stopFeedIds(id),
    };
  }

  function toTrip(row: Row): Trip {
    return {
      id: row.id as string,
      feedId: row.feed_id as string,
      routeId: row.route_id as string,
      directionId: (row.direction_id as number) === 1 ? 1 : 0,
      headsign: row.headsign as string,
      patternId: row.pattern_id as string,
    };
  }

  async function getCatalogVersion(): Promise<string> {
    const row = stmtCatalogVersion.get() as { value: string } | undefined;
    return row?.value ?? "";
  }

  async function getStop(stopId: StopId): Promise<Stop | undefined> {
    const row = stmtGetStop.get(stopId) as Row | undefined;
    return row ? toStop(row) : undefined;
  }

  async function findStopsNear(
    center: LatLon,
    radiusMeters: number,
    limit: number,
  ): Promise<StopWithDistance[]> {
    const box = boundingBox(center, radiusMeters);
    const rows = stmtStopsInBox.all(box.minLat, box.maxLat, box.minLon, box.maxLon) as Row[];
    const withDistance = rows
      .map((row) => {
        const stop = toStop(row);
        return { stop, distanceMeters: haversineMeters(center, stop) };
      })
      .filter((entry) => entry.distanceMeters <= radiusMeters)
      .sort((a, b) => a.distanceMeters - b.distanceMeters || (a.stop.id < b.stop.id ? -1 : 1));
    return withDistance.slice(0, limit);
  }

  async function findStopsInBounds(
    bounds: Bounds,
    limit: number,
  ): Promise<{ stops: Stop[]; truncated: boolean }> {
    const rows = stmtStopsInBox.all(
      bounds.minLat,
      bounds.maxLat,
      bounds.minLon,
      bounds.maxLon,
    ) as Row[];
    const center = boundsCenter(bounds);
    const sorted = rows
      .map(toStop)
      .sort((a, b) => haversineMeters(center, a) - haversineMeters(center, b));
    return { stops: sorted.slice(0, limit), truncated: sorted.length > limit };
  }

  async function findNearestStop(
    center: LatLon,
    maxDistanceMeters: number,
  ): Promise<StopWithDistance | undefined> {
    const box = boundingBox(center, maxDistanceMeters);
    const rows = stmtStopsInBox.all(box.minLat, box.maxLat, box.minLon, box.maxLon) as Row[];
    let best: StopWithDistance | undefined;
    for (const row of rows) {
      const stop = toStop(row);
      const distanceMeters = haversineMeters(center, stop);
      if (distanceMeters > maxDistanceMeters) continue;
      if (!best || distanceMeters < best.distanceMeters) best = { stop, distanceMeters };
    }
    return best;
  }

  function searchRoutesOnce(normalizedQuery: string, limit: number): Route[] {
    const words = normalizedQuery.split(" ").filter((word) => word.length > 0);
    const scored = new Map<string, { route: Route; score: number }>();

    const exactRows = stmtRouteExact.all(normalizedQuery) as Row[];
    for (const row of exactRows) {
      const route = toRoute(row);
      scored.set(route.id, { route, score: 3 });
    }

    const startsWithRows = stmtRouteStartsWith.all(normalizedQuery) as Row[];
    for (const row of startsWithRows) {
      const route = toRoute(row);
      const existing = scored.get(route.id);
      if (!existing || existing.score < 2) scored.set(route.id, { route, score: 2 });
    }

    const ftsExpr = ftsPrefixOr("long_name", words);
    if (ftsExpr) {
      const ftsRows = stmtRoutesFts.all(ftsExpr) as Array<{ route_id: string }>;
      for (const { route_id: routeId } of ftsRows) {
        if (scored.has(routeId)) continue;
        const row = stmtRouteById.get(routeId) as Row | undefined;
        if (row) scored.set(routeId, { route: toRoute(row), score: 1 });
      }
    }

    return [...scored.values()]
      .sort(compareRoutesForSearch)
      .slice(0, limit)
      .map((e) => e.route);
  }

  async function searchRoutes(normalizedQuery: string, limit: number): Promise<Route[]> {
    const direct = searchRoutesOnce(normalizedQuery, limit);
    if (direct.length > 0) return direct;
    if (VARIANT_SUFFIX_PATTERN.test(normalizedQuery)) {
      return searchRoutesOnce(normalizedQuery.slice(0, -1), limit);
    }
    return direct;
  }

  async function searchStops(normalizedQuery: string, limit: number): Promise<Stop[]> {
    const words = normalizedQuery.split(" ").filter((word) => word.length > 0);
    const scored = new Map<string, { stop: Stop; score: number }>();

    const exactRows = stmtStopExact.all(normalizedQuery) as Row[];
    for (const row of exactRows) {
      const stop = toStop(row);
      scored.set(stop.id, { stop, score: 2 });
    }

    const ftsExpr = ftsPrefixAnd("name", words);
    if (ftsExpr) {
      const ftsRows = stmtStopsFts.all(ftsExpr) as Array<{ stop_id: string }>;
      for (const { stop_id: stopId } of ftsRows) {
        if (scored.has(stopId)) continue;
        const row = stmtStopById.get(stopId) as Row | undefined;
        if (row) scored.set(stopId, { stop: toStop(row), score: 1 });
      }
    }

    return [...scored.values()]
      .sort(compareStopsForSearch)
      .slice(0, limit)
      .map((e) => e.stop);
  }

  async function getRoute(routeId: RouteId): Promise<Route | undefined> {
    const row = stmtRouteById.get(routeId) as Row | undefined;
    return row ? toRoute(row) : undefined;
  }

  async function getRoutesServingStop(stopId: StopId): Promise<Route[]> {
    const rows = stmtRoutesServingStop.all(stopId) as Row[];
    const routes = rows.map(toRoute);
    return routes.sort((a, b) => {
      const aOrder = a.sortOrder;
      const bOrder = b.sortOrder;
      if (aOrder !== undefined && bOrder !== undefined && aOrder !== bOrder) return aOrder - bOrder;
      if (aOrder !== undefined && bOrder === undefined) return -1;
      if (aOrder === undefined && bOrder !== undefined) return 1;
      return NATURAL_COLLATOR.compare(a.shortName, b.shortName);
    });
  }

  async function getRoutePatterns(routeId: RouteId): Promise<RoutePattern[]> {
    const rows = stmtPatterns.all(routeId) as Row[];
    return rows.map((row) => {
      const stopRows = stmtPatternStops.all(row.id as string) as Row[];
      return {
        id: row.id as string,
        routeId: row.route_id as string,
        directionId: (row.direction_id as number) === 1 ? 1 : 0,
        headsign: row.headsign as string,
        stops: stopRows.map(toStop),
        shape: JSON.parse(row.shape_json as string) as LatLon[],
      };
    });
  }

  async function getTrip(tripId: TripId): Promise<Trip | undefined> {
    const row = stmtGetTrip.get(tripId) as Row | undefined;
    return row ? toTrip(row) : undefined;
  }

  async function getScheduledStopTimesAtStop(
    stopId: StopId,
    from: EpochSeconds,
    to: EpochSeconds,
  ): Promise<ScheduledStopTime[]> {
    const results: ScheduledStopTime[] = [];

    for (const feed of feedsCache) {
      const fromDate = localServiceDate(from, feed.timezone);
      const toDate = localServiceDate(to, feed.timezone);
      const candidateDates = new Set(datesBetween(addDays(fromDate, -1), toDate));

      const rows = stmtStopTimesAtStopForFeed.all(stopId, feed.id) as Array<{
        tripId: string;
        stopSequence: number;
        timeSeconds: number;
        routeId: string;
        directionId: number;
        headsign: string;
        serviceDate: string;
      }>;

      for (const row of rows) {
        if (!candidateDates.has(row.serviceDate)) continue;
        const time = epochFor(row.serviceDate, row.timeSeconds, feed.timezone);
        if (time < from || time > to) continue;
        results.push({
          tripId: row.tripId,
          routeId: row.routeId,
          directionId: row.directionId === 1 ? 1 : 0,
          headsign: row.headsign,
          stopId,
          stopSequence: row.stopSequence,
          serviceDate: row.serviceDate,
          time,
        });
      }
    }

    results.sort((a, b) => a.time - b.time);
    return results;
  }

  async function getScheduledStopTimesForServiceDate(
    stopId: StopId,
    serviceDate: ServiceDate,
  ): Promise<ScheduledStopTime[]> {
    const timezoneByFeed = new Map(feedsCache.map((feed) => [feed.id, feed.timezone]));
    const rows = stmtDeparturesAtStopForDate.all(stopId, serviceDate) as Array<{
      stopSequence: number;
      tripId: string;
      timeSeconds: number;
      feedId: string;
      routeId: string;
      directionId: number;
      headsign: string;
    }>;

    const results: ScheduledStopTime[] = [];
    for (const row of rows) {
      const timezone = timezoneByFeed.get(row.feedId);
      if (timezone === undefined) continue;
      results.push({
        tripId: row.tripId,
        routeId: row.routeId,
        directionId: row.directionId === 1 ? 1 : 0,
        headsign: row.headsign,
        stopId,
        stopSequence: row.stopSequence,
        serviceDate,
        time: epochFor(serviceDate, row.timeSeconds, timezone),
      });
    }
    results.sort((a, b) => a.time - b.time);
    return results;
  }

  async function getServiceDates(): Promise<ServiceDate[]> {
    const rows = stmtServiceDates.all() as Array<{ service_date: string }>;
    return rows.map((row) => row.service_date);
  }

  async function getScheduledStopTimesForTrip(
    tripId: TripId,
    serviceDate: ServiceDate,
  ): Promise<ScheduledStopTime[]> {
    const tripRow = stmtGetTrip.get(tripId) as Row | undefined;
    if (!tripRow) return [];

    const feed = feedsCache.find((f) => f.id === tripRow.feed_id);
    if (!feed) return [];

    const rows = stmtStopTimesForTrip.all(tripId) as Array<{
      stop_sequence: number;
      stop_id: string;
      time_seconds: number;
    }>;

    return rows.map((row) => ({
      tripId,
      routeId: tripRow.route_id as string,
      directionId: (tripRow.direction_id as number) === 1 ? 1 : 0,
      headsign: tripRow.headsign as string,
      stopId: row.stop_id,
      stopSequence: row.stop_sequence,
      serviceDate,
      time: epochFor(serviceDate, row.time_seconds, feed.timezone),
    }));
  }

  return {
    getCatalogVersion,
    getStop,
    findStopsNear,
    findNearestStop,
    findStopsInBounds,
    searchRoutes,
    searchStops,
    getRoute,
    getRoutesServingStop,
    getRoutePatterns,
    getTrip,
    getScheduledStopTimesAtStop,
    getScheduledStopTimesForTrip,
    getScheduledStopTimesForServiceDate,
    getServiceDates,
  };
}
