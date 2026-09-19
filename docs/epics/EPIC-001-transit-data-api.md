# EPIC-001 — Transit data API

| Field | Value |
|---|---|
| Status | Done |
| Depends on | Monorepo setup (done): `@transit/core`, `@transit/gtfs`, `@transit/contracts`, `@transit/api-client`, `@transit/server`, `GET /api/v1/health` |
| Related decisions | Project decisions document: data architecture, GTFS-RT normalization rules, Merger rules, Vercel server design |
| Read first | `AGENTS.md`, `docs/engineering/architecture.md`, `principles.md`, `typescript.md`, `testing.md`, `server.md`, `workflow.md` |

---

## 1. Goal

The server downloads and processes public transit data from **Metro Transit** and **MVTA** and serves it through
versioned JSON endpoints that the mobile app will consume.

### Definition of success

1. `pnpm --filter @transit/server catalog:build` builds one SQLite catalog from both agencies' GTFS static feeds.
2. These endpoints work locally against the real catalog and live feeds, protected by the API key:
   - `GET /api/v1/stops/nearby`
   - `GET /api/v1/search`
   - `GET /api/v1/stops/{stopId}/arrivals`
   - `GET /api/v1/routes/{routeId}`
   - `GET /api/v1/routes/{routeId}/vehicles`
   - `GET /api/v1/vehicles/{vehicleId}`
   - `GET /api/v1/health` (now reporting real feed status and catalog version)
3. Arrivals combine schedule and realtime data and always state `source: "live" | "scheduled"`.
4. All normalization and merge rules are generic (no agency-, route- or stop-specific code) and are covered by tests
   built from real feed samples.
5. `@transit/api-client` exposes one typed method per endpoint.
6. The server is deployable to Vercel with a daily catalog rebuild (cron → deploy hook).
7. `pnpm verify` passes.

---

## 2. Scope

### In scope
- GTFS static ingestion for both agencies into one SQLite catalog (build time).
- GTFS-Realtime VehiclePosition and TripUpdate ingestion (request time, cached 20 s).
- Domain logic in `@transit/core`: arrival merge, freshness, direction selection, approaching vehicles, search ranking.
- Adapters in `@transit/gtfs`.
- Contracts, API client methods, route handlers, composition root, configuration.
- Vercel configuration: cron job, deploy hook trigger, catalog file tracing.
- Test fixtures and tests.

### Out of scope (do not implement)
- Service Alerts (feeds not inspected yet).
- Any mobile UI work.
- Trip planning, walking directions, transfers, address/place search, search by vehicle unit number.
- Favorites, notifications, user accounts, external databases, Redis.
- NexTrip API.
- Agencies other than Metro Transit and MVTA.
- CDN caching of API responses.

---

## 3. Decisions this epic relies on

Confirmed by the product owner:

| Topic | Decision |
|---|---|
| Catalog strategy | **Build-time catalog (option A).** A daily Vercel cron triggers a deploy hook; the build downloads the GTFS feeds and generates a SQLite file bundled with the deployment. |
| Realtime cache TTL | **20 seconds** per feed. |
| Stale realtime data | **Hide data older than 120 seconds.** Stale vehicle positions are not returned; stale predictions are ignored and arrivals fall back to `scheduled`. |
| Service Alerts | **Not in this epic.** |

Defined by this epic (technical decisions inside the approved architecture; implement exactly as written):

| Topic | Decision |
|---|---|
| Catalog storage engine | Built-in `node:sqlite` (`DatabaseSync`), opened read-only at request time. No native npm SQLite dependency. |
| Runtime | Node.js 24 on Vercel (`"engines": { "node": "24.x" }` in `apps/server/package.json`). |
| Feed priority | `metrotransit` first, `mvta` second (used when both feeds define the same stop). |
| Response caching | No CDN caching (the API is key-protected). Realtime endpoints: `Cache-Control: no-store`. Catalog-only endpoints: `Cache-Control: private, max-age=300`. |
| Input validation | Small hand-written parsers in `apps/server/src/http/params.ts`. No validation library. |
| Allowed new dependencies | `@transit/gtfs`: `gtfs-realtime-bindings`, `fflate`, `csv-parse` (dependencies), `tsx` (dev). `@transit/server`: `@transit/core`, `@transit/gtfs` (workspace), `tsx` (dev). `@types/node@^24` where Node types are needed. Nothing else without asking. |

---

## 4. Architecture for this epic

### 4.1 Build time (catalog)

```
apps/server "build" script
  ├─ scripts/build-catalog.ts                 (run with tsx)
  │    ├─ imports FEEDS from src/config/feeds.ts
  │    └─ calls buildCatalog() from @transit/gtfs
  │         ├─ download each feed's GTFS zip
  │         ├─ unzip (fflate) → parse CSV (csv-parse)
  │         ├─ normalize ids, times, service dates, patterns, shapes
  │         └─ write apps/server/generated/catalog.sqlite
  └─ next build                               (catalog file traced into the API functions)

Vercel cron (daily) → GET /api/cron/rebuild-catalog → POST deploy hook → new build with a fresh catalog
```

If a feed download fails during the build, the build fails and Vercel keeps serving the previous deployment.

### 4.2 Request time

```
Route handler (apps/server/app/api/v1/**/route.ts)
  auth → parse params → TransitService use case → map to contracts → respond
          │
TransitService (@transit/core)
  ├─ CatalogProvider      ← SqliteCatalogProvider (@transit/gtfs, node:sqlite, read-only)
  ├─ RealtimeProvider[]   ← GtfsRealtimeProvider, one per feed (@transit/gtfs)
  │     └─ Cache          ← InMemoryCache (apps/server), 20 s TTL, single-flight
  └─ Clock                ← SystemClock (apps/server)
```

### 4.3 Package responsibilities in this epic

| Package | Adds |
|---|---|
| `@transit/core` | Model additions, revised ports, pure domain functions, `TransitService`, settings type |
| `@transit/gtfs` | `static/` catalog builder, `catalog/` SQLite provider, `realtime/` GTFS-RT provider, `time/` helpers, fixture tooling |
| `@transit/contracts` | DTOs for every endpoint, new error code |
| `@transit/api-client` | One method per endpoint |
| `apps/server` | Feed config, settings, composition root, cache and clock, params parsing, mappers, route handlers, cron route, build script, Vercel config |

---

## 5. Identifiers

| Entity | Canonical id | Example |
|---|---|---|
| Feed | Configuration key | `metrotransit`, `mvta` |
| Agency | `${feedId}:${agency_id}` | `mvta:0` |
| Route | `${feedId}:${route_id}` | `mvta:436` |
| Trip | `${feedId}:${trip_id}` | `metrotransit:1325041` |
| Vehicle | `${feedId}:${vehicle.id}` | `mvta:4266` |
| Stop | Raw regional `stop_id`, shared across feeds | `56939` |
| Pattern | `${routeId}:${directionId}` | `mvta:436:1` |
| Service date | `YYYYMMDD` in the feed time zone | `20260916` |

- If `routes.agency_id` is empty and the feed has exactly one agency, use that agency's id; if the feed has several agencies, use `default`.
- Path parameters arrive URL-encoded (`mvta%3A436`). Route handlers decode them with `decodeURIComponent`.

---

## 6. Configuration

### 6.1 Feeds — `apps/server/src/config/feeds.ts`

```ts
import type { FeedConfig } from "@transit/core";

/** Array order is the feed priority (first wins for shared stop names and coordinates). */
export const FEEDS: readonly FeedConfig[] = [
  {
    id: "metrotransit",
    name: "Metro Transit",
    timezone: "America/Chicago",
    staticUrl: "https://svc.metrotransit.org/mtgtfs/gtfs.zip",
    vehiclePositionsUrl: "https://svc.metrotransit.org/mtgtfs/vehiclepositions.pb",
    tripUpdatesUrl: "https://svc.metrotransit.org/mtgtfs/tripupdates.pb",
  },
  {
    id: "mvta",
    name: "MVTA",
    timezone: "America/Chicago",
    staticUrl: "https://srv.mvta.com/InfoPoint/GTFS-zip.ashx",
    vehiclePositionsUrl: "https://srv.mvta.com/infoPoint/GTFS-realtime.ashx?&Type=VehiclePosition",
    tripUpdatesUrl: "https://srv.mvta.com/infoPoint/GTFS-realtime.ashx?&Type=TripUpdate",
  },
];
```

### 6.2 Settings — `apps/server/src/config/transit-settings.ts`

Named constants grouped into one `TransitSettings` object passed to `TransitService` and adapters.
Never hard-code these values anywhere else.

| Setting | Value | Used by |
|---|---|---|
| `realtimeCacheTtlSeconds` | `20` | Realtime providers |
| `realtimeStaleAfterSeconds` | `120` | Vehicle and prediction freshness |
| `feedFetchTimeoutMs` | `8000` | Realtime downloads |
| `nearbyDefaultRadiusMeters` | `500` | `stops/nearby` when `radius` is omitted |
| `nearbyMinRadiusMeters` / `nearbyMaxRadiusMeters` | `50` / `2000` | Validation |
| `nearbyMaxStops` | `10` | `stops/nearby` |
| `nearbyFallbackMaxDistanceMeters` | `5000` | Nearest stop when none is inside the radius |
| `nearbyArrivalsPerStop` | `3` | `stops/nearby` |
| `arrivalsWindowMinutes` | `90` | Nearby and stop arrivals |
| `stopArrivalsLimit` | `30` | `stops/{stopId}/arrivals` |
| `pastArrivalGraceSeconds` | `60` | Arrivals up to 60 s in the past are still returned |
| `searchMaxRoutes` / `searchMaxStops` | `10` / `20` | `search` |
| `searchMaxQueryLength` | `50` | Validation |
| `catalogServiceDaysBefore` / `catalogServiceDaysAfter` | `1` / `13` | Service dates materialized at build time |
| `patternLookaheadDays` | `7` | Representative pattern selection |
| `shapeSimplifyToleranceMeters` | `5` | Shape simplification |
| `httpUserAgent` | `"transit-app/0.1 (personal use)"` | All outgoing requests |

### 6.3 Environment variables — `apps/server`

| Variable | Required | Purpose |
|---|---|---|
| `API_KEY` | Always | Client authentication (`x-api-key`) |
| `CRON_SECRET` | Production | Vercel sends `Authorization: Bearer <CRON_SECRET>` to cron routes |
| `CATALOG_DEPLOY_HOOK_URL` | Production | Deploy hook URL called by the cron route |
| `CATALOG_PATH` | Optional | Catalog location; default `generated/catalog.sqlite` resolved from `process.cwd()` |

---

## 7. Domain model and ports (`@transit/core`)

Replace the current `model.ts` and `ports.ts` content with the definitions below (keep file names).
Existing types not listed here (`Alert`) stay unchanged. Comments may be expanded but names, fields and signatures must match.

### 7.1 Model additions and changes — `packages/core/src/model.ts`

```ts
export type FeedId = string;
export type ServiceDate = string; // YYYYMMDD in the feed time zone

export interface FeedConfig {
  id: FeedId;
  name: string;
  timezone: string; // IANA, e.g. "America/Chicago"
  staticUrl: string;
  vehiclePositionsUrl: string;
  tripUpdatesUrl: string;
}

export interface Agency { id: AgencyId; feedId: FeedId; name: string }

export interface Route {
  id: RouteId;
  feedId: FeedId;
  agencyId: AgencyId;
  shortName: string;   // may be empty
  longName: string;    // may be empty
  color?: string;      // hex without "#"
  textColor?: string;
  sortOrder?: number;
}

export interface Stop extends LatLon {
  id: StopId;
  code: string;        // stop_code, falls back to stop_id
  name: string;
  feedIds: FeedId[];   // replaces agencyIds
}

export interface StopWithDistance { stop: Stop; distanceMeters: number }

export interface Trip {
  id: TripId;
  feedId: FeedId;
  routeId: RouteId;
  directionId: DirectionId;
  headsign: string;
  patternId: string;
}

export interface ScheduledStopTime {
  tripId: TripId;
  routeId: RouteId;
  directionId: DirectionId;
  headsign: string;
  stopId: StopId;
  stopSequence: number;
  serviceDate: ServiceDate;
  time: EpochSeconds;  // departure time, falls back to arrival time
}

export interface RoutePattern {
  id: string;              // `${routeId}:${directionId}`
  routeId: RouteId;
  directionId: DirectionId;
  headsign: string;
  stops: Stop[];           // ordered
  shape: LatLon[];         // simplified polyline
}

export type StopTimeStatus = "normal" | "canceled" | "skipped";

/** One normalized GTFS-RT stop time update (future stops only). */
export interface StopTimePrediction {
  feedId: FeedId;
  tripId: TripId;
  serviceDate?: ServiceDate;   // from trip.start_date when present
  routeId: RouteId;
  directionId: DirectionId;
  stopId: StopId;
  stopSequence?: number;
  time: EpochSeconds;          // for status "normal"; for canceled/skipped, 0 means "use schedule"
  delaySec?: number;
  status: StopTimeStatus;
  vehicleId?: VehicleId;
}

export interface Vehicle extends LatLon {
  id: VehicleId;
  feedId: FeedId;
  label?: string;
  routeId: RouteId;
  directionId: DirectionId;
  tripId: TripId;
  bearing?: number;
  currentStopSequence?: number;
  updatedAt: EpochSeconds;
  occupancy?: OccupancyStatus;
}

export interface Arrival {
  stopId: StopId;
  routeId: RouteId;
  directionId: DirectionId;
  tripId: TripId;
  headsign: string;
  stopSequence?: number;       // from the matched scheduled row
  time: EpochSeconds;
  scheduledTime?: EpochSeconds;
  delaySec?: number;
  source: "live" | "scheduled";
  status: StopTimeStatus;
  vehicleId?: VehicleId;
}

export interface FeedStatus {
  feedId: FeedId;
  ok: boolean;                  // fetched successfully and not stale
  dataTimestamp?: EpochSeconds; // feed header timestamp
  fetchedAt?: EpochSeconds;
}
```

`Freshness` is replaced by `FeedStatus`. `ArrivalSource`/`ArrivalStatus` may remain as aliases.

### 7.2 Ports — `packages/core/src/ports.ts`

```ts
export interface CatalogProvider {
  getCatalogVersion(): Promise<string>;
  getStop(stopId: StopId): Promise<Stop | undefined>;
  findStopsNear(center: LatLon, radiusMeters: number, limit: number): Promise<StopWithDistance[]>;
  findNearestStop(center: LatLon, maxDistanceMeters: number): Promise<StopWithDistance | undefined>;
  searchRoutes(normalizedQuery: string, limit: number): Promise<Route[]>;
  searchStops(normalizedQuery: string, limit: number): Promise<Stop[]>;
  getRoute(routeId: RouteId): Promise<Route | undefined>;
  getRoutesServingStop(stopId: StopId): Promise<Route[]>;
  getRoutePatterns(routeId: RouteId): Promise<RoutePattern[]>;
  getTrip(tripId: TripId): Promise<Trip | undefined>;
  getScheduledStopTimesAtStop(stopId: StopId, from: EpochSeconds, to: EpochSeconds): Promise<ScheduledStopTime[]>;
  getScheduledStopTimesForTrip(tripId: TripId, serviceDate: ServiceDate): Promise<ScheduledStopTime[]>;
}

export interface RealtimeSnapshot {
  feedId: FeedId;
  vehicles: Vehicle[];
  predictions: StopTimePrediction[];
  status: FeedStatus;
}

export interface RealtimeProvider {
  readonly feedId: FeedId;
  readonly capabilities: ProviderCapabilities;
  /** Never throws: failures are reported through `status.ok = false` with empty data. */
  getSnapshot(): Promise<RealtimeSnapshot>;
}

export interface Clock { now(): EpochSeconds }

export interface Cache {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
}
```

`ProviderCapabilities` stays as defined today.

### 7.3 `TransitSettings` and `TransitService` — `packages/core/src/`

- `settings.ts`: `export interface TransitSettings { ... }` with exactly the fields of section 6.2.
- `transit-service.ts`: `export function createTransitService(deps: { catalog: CatalogProvider; realtime: RealtimeProvider[]; clock: Clock; settings: TransitSettings })` returning:

```ts
{
  getNearby(center: LatLon, radiusMeters: number): Promise<NearbyResult>;
  search(rawQuery: string): Promise<SearchResult>;
  getStopArrivals(stopId: StopId): Promise<StopArrivalsResult | undefined>;          // undefined = stop not found
  getRouteDetail(routeId: RouteId, options: { directionId?: DirectionId; near?: LatLon }): Promise<RouteDetailResult | undefined>;
  getRouteVehicles(routeId: RouteId, directionId?: DirectionId): Promise<RouteVehiclesResult | undefined>;
  getVehicleDetail(vehicleId: VehicleId): Promise<VehicleDetailResult | undefined>;
  getHealth(): Promise<HealthResult>;
}
```

Also export `export type TransitService = ReturnType<typeof createTransitService>;`.

Result types (domain, in `transit-service.ts`) mirror the contracts in section 8 but use domain types
(`Stop`, `Route`, `Arrival`, `Vehicle`, `FeedStatus`). The server maps them to contracts.

---

## 8. API contracts (`@transit/contracts`)

Add to `packages/contracts/src/index.ts`. Keep existing exports. All times are Unix epoch seconds.

```ts
// Error codes: add "catalog_unavailable" (HTTP 503).
export type ApiErrorCode =
  | "unauthorized" | "invalid_request" | "not_found"
  | "catalog_unavailable" | "server_misconfigured" | "internal_error";

export interface LatLonDto { lat: number; lon: number }

export interface FeedStatusDto { feedId: string; ok: boolean; dataTimestamp?: number; fetchedAt?: number }

export interface RouteSummaryDto {
  id: string; feedId: string; shortName: string; longName: string; color?: string; textColor?: string;
}

export interface StopSummaryDto extends LatLonDto { id: string; code: string; name: string }

export interface ArrivalDto {
  tripId: string; routeId: string; routeShortName: string; routeColor?: string;
  directionId: 0 | 1; headsign: string;
  time: number; scheduledTime?: number; delaySec?: number;
  source: "live" | "scheduled"; status: "normal" | "canceled" | "skipped";
  vehicleId?: string;
}

export interface VehicleDto extends LatLonDto {
  id: string; label?: string; routeId: string; routeShortName: string;
  directionId: 0 | 1; headsign: string; tripId: string;
  bearing?: number; updatedAt: number;
  occupancy?: "empty" | "many_seats_available" | "few_seats_available" | "standing_room_only"
    | "crushed_standing_room_only" | "full" | "not_accepting_passengers" | "unknown";
}

/** GET /api/v1/stops/nearby?lat=&lon=&radius= */
export interface NearbyStopDto {
  stop: StopSummaryDto; distanceMeters: number; routes: RouteSummaryDto[];
  nextArrivals: ArrivalDto[]; approachingVehicles: VehicleDto[];
}
export interface NearbyStopsResponse {
  stops: NearbyStopDto[];
  /** true when no stop was inside the radius and the nearest stop was returned instead. */
  outsideRadius: boolean;
  feeds: FeedStatusDto[];
}

/** GET /api/v1/search?q= */
export interface SearchResponse { routes: RouteSummaryDto[]; stops: StopSummaryDto[] }

/** GET /api/v1/stops/{stopId}/arrivals */
export interface StopArrivalsResponse {
  stop: StopSummaryDto; routes: RouteSummaryDto[]; arrivals: ArrivalDto[]; feeds: FeedStatusDto[];
}

/** GET /api/v1/routes/{routeId}?directionId=&lat=&lon= */
export interface RouteDirectionDto { directionId: 0 | 1; headsign: string }
export interface RouteDetailResponse {
  route: RouteSummaryDto;
  directions: RouteDirectionDto[];
  selectedDirectionId: 0 | 1;
  stops: StopSummaryDto[];       // ordered, selected direction
  shape: LatLonDto[];            // selected direction
}

/** GET /api/v1/routes/{routeId}/vehicles?directionId= */
export interface RouteVehiclesResponse { routeId: string; vehicles: VehicleDto[]; feeds: FeedStatusDto[] }

/** GET /api/v1/vehicles/{vehicleId} */
export interface UpcomingStopDto {
  stop: StopSummaryDto; stopSequence: number;
  time: number; scheduledTime?: number; delaySec?: number;
  source: "live" | "scheduled"; status: "normal" | "canceled" | "skipped";
}
export interface VehicleDetailResponse {
  vehicle: VehicleDto; route: RouteSummaryDto; upcomingStops: UpcomingStopDto[]; feeds: FeedStatusDto[];
}

/** GET /api/v1/health — replaces the current shape (feeds now use FeedStatusDto). */
export interface HealthResponse {
  status: "ok" | "degraded";
  checkedAt: number;
  catalogVersion?: string;
  feeds: FeedStatusDto[];
}
```

`feeds` in responses contains the status of every configured realtime feed that was consulted by the request.

---

## 9. Catalog database (SQLite)

File: `apps/server/generated/catalog.sqlite` (add `apps/server/generated/` to `.gitignore`).
Build writes to a temporary file and renames it at the end (atomic replace).

```sql
PRAGMA journal_mode = OFF;
PRAGMA synchronous = OFF;

CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
-- keys: catalog_version (ISO build time + feed versions), built_at (epoch), service_window_start, service_window_end

CREATE TABLE feeds (id TEXT PRIMARY KEY, name TEXT NOT NULL, timezone TEXT NOT NULL, feed_version TEXT, priority INTEGER NOT NULL);

CREATE TABLE agencies (id TEXT PRIMARY KEY, feed_id TEXT NOT NULL, name TEXT NOT NULL);

CREATE TABLE routes (
  id TEXT PRIMARY KEY, feed_id TEXT NOT NULL, agency_id TEXT NOT NULL,
  short_name TEXT NOT NULL, long_name TEXT NOT NULL, color TEXT, text_color TEXT, sort_order INTEGER
);

CREATE TABLE stops (id TEXT PRIMARY KEY, code TEXT NOT NULL, name TEXT NOT NULL, lat REAL NOT NULL, lon REAL NOT NULL);
CREATE INDEX stops_lat_lon ON stops (lat, lon);
CREATE TABLE stop_feeds (stop_id TEXT NOT NULL, feed_id TEXT NOT NULL, PRIMARY KEY (stop_id, feed_id));

CREATE TABLE trips (
  id TEXT PRIMARY KEY, feed_id TEXT NOT NULL, route_id TEXT NOT NULL, service_id TEXT NOT NULL,
  direction_id INTEGER NOT NULL, headsign TEXT NOT NULL, shape_id TEXT, pattern_id TEXT NOT NULL
);
CREATE INDEX trips_route ON trips (route_id, direction_id);

CREATE TABLE stop_times (
  trip_id TEXT NOT NULL, stop_sequence INTEGER NOT NULL, stop_id TEXT NOT NULL, time_seconds INTEGER NOT NULL,
  PRIMARY KEY (trip_id, stop_sequence)
) WITHOUT ROWID;
CREATE INDEX stop_times_stop ON stop_times (stop_id);

-- service_id is feed-scoped: `${feedId}:${service_id}`
CREATE TABLE service_dates (service_id TEXT NOT NULL, service_date TEXT NOT NULL, PRIMARY KEY (service_id, service_date)) WITHOUT ROWID;
CREATE INDEX service_dates_date ON service_dates (service_date);

CREATE TABLE route_stops (route_id TEXT NOT NULL, stop_id TEXT NOT NULL, PRIMARY KEY (route_id, stop_id)) WITHOUT ROWID;
CREATE INDEX route_stops_stop ON route_stops (stop_id);

CREATE TABLE patterns (id TEXT PRIMARY KEY, route_id TEXT NOT NULL, direction_id INTEGER NOT NULL, headsign TEXT NOT NULL, trip_count INTEGER NOT NULL, shape_json TEXT NOT NULL);
CREATE TABLE pattern_stops (pattern_id TEXT NOT NULL, position INTEGER NOT NULL, stop_id TEXT NOT NULL, PRIMARY KEY (pattern_id, position)) WITHOUT ROWID;

CREATE VIRTUAL TABLE routes_fts USING fts5(route_id UNINDEXED, short_name, long_name, tokenize = 'unicode61 remove_diacritics 2');
CREATE VIRTUAL TABLE stops_fts USING fts5(stop_id UNINDEXED, name, tokenize = 'unicode61 remove_diacritics 2');
```

Notes:
- `stop_times.time_seconds` = seconds after local midnight of the service date (`departure_time`, falling back to `arrival_time`). Values may exceed 86400.
- `trips.pattern_id` is always `${route_id}:${direction_id}` (canonical ids). `patterns` stores one representative pattern per route and direction (section 10.5).
- Create indexes **after** bulk inserts; wrap inserts in a single transaction per table.

---

## 10. Algorithms (implement exactly)

Every rule below is generic. Each rule must have at least one unit test (section 13 lists the required tests).

### 10.1 GTFS local time → epoch seconds (`packages/gtfs/src/time/`)

GTFS times are "seconds after noon minus 12 hours" of the service date, in the feed time zone.

```
epochFor(serviceDate, secondsAfterMidnight, timezone) =
  zonedEpoch(serviceDate at 12:00:00 local, timezone) - 12 * 3600 + secondsAfterMidnight
```

- `zonedEpoch` converts a local wall-clock time to epoch using `Intl.DateTimeFormat` with `timeZone`
  (compute the zone offset for that instant; re-check once after applying the offset to handle DST).
- `parseGtfsTime("25:10:00")` → `90600`. Invalid format → throw `GtfsParseError` with file and row number.
- `localServiceDate(epoch, timezone)` → `YYYYMMDD` of the local calendar date.
- Required tests: normal day, a time ≥ 24:00:00, the DST start date (2026-03-08) and DST end date (2026-11-01) in `America/Chicago`.

### 10.2 Service dates (build time)

For each date `D` from `buildDate - catalogServiceDaysBefore` to `buildDate + catalogServiceDaysAfter` (local dates of the feed time zone):
1. A `service_id` is active on `D` if `calendar.txt` has a row where `start_date ≤ D ≤ end_date` and the weekday column for `D` is `1`.
2. Apply `calendar_dates.txt`: `exception_type = 1` adds the service on `D`; `exception_type = 2` removes it.
3. Feeds may omit `calendar.txt` (MVTA) or `calendar_dates.txt`; treat a missing file as empty.
4. Store rows in `service_dates` with feed-scoped `service_id`.

### 10.3 Stops

- Import rows with `location_type` empty or `0` only (boarding stops). Ignore stations, entrances, nodes and boarding areas.
- `code` = `stop_code` if not empty, otherwise `stop_id`.
- If a `stop_id` already exists from a higher-priority feed, keep its name and coordinates and only add a `stop_feeds` row.
- Skip stops whose coordinates are missing or `0,0`.

### 10.4 Stop times

- `time_seconds` = `departure_time`, else `arrival_time`.
- If both are empty (non-timepoint), interpolate linearly between the previous and next timed stops of the same trip,
  using `shape_dist_traveled` when both neighbors and the row have it, otherwise the stop position index. Round to the nearest second.
- Drop stop times whose `stop_id` was not imported (section 10.3); drop trips left with fewer than 2 stop times.
- Only import trips whose `service_id` is active on at least one date of the service window.

### 10.5 Representative pattern per route and direction

For each `(route, direction_id)`:
1. Consider trips with at least one active service date in `[buildDate, buildDate + patternLookaheadDays]`.
   If none, consider all imported trips of that route and direction.
2. Group trips by their ordered `stop_id` sequence.
3. Pick the group with the most trips; tie → the group with more stops; tie → the group whose first trip id sorts first.
4. `headsign` = most frequent `trip_headsign` in the group (tie → alphabetical first); if empty, the name of the last stop.
5. Shape = the most frequent non-empty `shape_id` in the group, simplified with Ramer–Douglas–Peucker
   (`shapeSimplifyToleranceMeters`). If the group has no shape, use the stop coordinates in order.
6. `route_stops` = every `(route_id, stop_id)` pair appearing in any imported trip of the route (not only the pattern).

If `direction_id` is empty for a trip, use `0`.

### 10.6 Search normalization and ranking

`normalizeQuery(raw)`: trim, collapse internal whitespace, lowercase, remove diacritics. Empty after normalization → `400 invalid_request`.

Routes (in `SqliteCatalogProvider.searchRoutes`, ranking in `@transit/core`):
- Score 3: `shortName` equals the query (case-insensitive).
- Score 2: `shortName` starts with the query.
- Score 1: any word of `longName` starts with a query word (FTS5 prefix match).
- **Variant suffix rule (generic):** if no route matched and the query matches `/^\d+[a-z]$/`, search again with the trailing letter removed.
  (Example: `436v` → `436`. This applies to any route number with a one-letter variant suffix.)
- Order: score desc, then `sortOrder` asc (missing = last), then `shortName` natural order, then `longName`. Limit `searchMaxRoutes`.

Stops:
- Score 2: `code` equals the query.
- Score 1: every query word prefixes a word in `name` (FTS5 `"word"*` terms joined with AND).
- Order: score desc, then name. Limit `searchMaxStops`.

Escape user input before building FTS5 expressions (quote each term, strip `"`).

### 10.7 GTFS-Realtime normalization (`packages/gtfs/src/realtime/`)

Decode with `gtfs-realtime-bindings` (`transit_realtime.FeedMessage.decode`). Then:

Vehicles (VehiclePosition feed):
1. Skip entities without `vehicle`, without `vehicle.trip.trip_id`, or with position latitude and longitude both `0` or missing.
2. `tripId` = `${feedId}:${trip_id}`; look the trip up with `catalog.getTrip`. Skip the vehicle if the trip is not in the catalog.
3. `routeId` and `directionId`: from the catalog trip (the catalog is authoritative; the feed's values are ignored).
4. `id` = `${feedId}:${vehicle.vehicle.id}`; if `vehicle.vehicle.id` is empty use `vehicle.vehicle.label`; if both empty, skip.
5. `updatedAt` = `vehicle.timestamp`, else the feed header timestamp.
6. Deduplicate by `id`, keeping the entity with the newest `updatedAt`.
7. Map `occupancy_status` enum names to the lowercase `OccupancyStatus` union; unknown → `"unknown"`.

Predictions (TripUpdate feed):
1. Skip entities without `trip_update.trip.trip_id` or whose trip is not in the catalog.
2. Trip `schedule_relationship = CANCELED` → one prediction per scheduled stop of that trip with `status: "canceled"`, `time: 0`.
   Service date = `trip.start_date`, else `localServiceDate(header.timestamp)`. Ignore its `stop_time_update` list.
3. For each `stop_time_update`:
   - `schedule_relationship = NO_DATA` → skip.
   - `SKIPPED` → `status: "skipped"`, `time: 0`.
   - Otherwise `time` = `arrival.time`, else `departure.time`; if neither exists but `arrival.delay` or `departure.delay` exists and the scheduled time is known, `time = scheduled + delay`; else skip.
   - Skip updates with `time < header.timestamp` (already passed).
   - `stopId` = `stop_id`; if empty, resolve it from the catalog trip stop times by `stop_sequence`; if unresolvable, skip.
4. `serviceDate` = `trip.start_date` when present.
5. `vehicleId` = `${feedId}:${trip_update.vehicle.id}` when present.
6. `delaySec` = the `delay` field of the used event when present.

### 10.8 Realtime provider, cache and freshness

- `GtfsRealtimeProvider` fetches VehiclePosition and TripUpdate in parallel with `feedFetchTimeoutMs` and `httpUserAgent`.
- Cache key: `realtime:${feedId}`. TTL: `realtimeCacheTtlSeconds`.
- **Single-flight:** concurrent calls while a fetch is in progress share the same promise (keep the in-flight promise in the provider instance, not in module scope).
- If one of the two downloads fails, return the successful part and set `status.ok = false`.
- If both fail, return empty arrays with `status.ok = false` and keep serving the last successful snapshot **only if** it is not stale.
- `status.dataTimestamp` = the older of the two header timestamps; `status.fetchedAt` = clock time of the fetch.
- **Stale rule (in `@transit/core`):** a feed is stale when `now - status.dataTimestamp > realtimeStaleAfterSeconds`; a stale feed contributes no vehicles and no predictions and reports `ok = false`.
- A vehicle is stale when `now - vehicle.updatedAt > realtimeStaleAfterSeconds`; stale vehicles are removed.

### 10.9 Arrival merge (`mergeArrivals`, pure, `@transit/core`)

Inputs: scheduled stop times at a stop for `[now - pastArrivalGraceSeconds, now + arrivalsWindowMinutes]`, fresh predictions for that stop, `now`.

1. Key scheduled rows and predictions by `tripId + "|" + serviceDate + "|" + stopId`.
2. A prediction without `serviceDate` matches the scheduled row of the same trip and stop whose `time` is closest to the prediction time, if within 3 hours.
3. Matched `normal` prediction → `source: "live"`, `time` = prediction time, `scheduledTime` = scheduled time, `delaySec` = prediction delay or `time - scheduledTime`.
4. Matched `canceled` or `skipped` prediction → `source: "live"`, `status` from the prediction, `time` = scheduled time.
5. Unmatched scheduled row → `source: "scheduled"`, `status: "normal"`, `time` = scheduled time.
6. Unmatched `normal` prediction whose trip exists in the catalog and whose time is inside the window → `source: "live"`, no `scheduledTime`.
7. Remove arrivals with `time < now - pastArrivalGraceSeconds` or `time > now + arrivalsWindowMinutes * 60`.
8. Sort by `time` asc, then route short name natural order, then `tripId`.
9. Apply the endpoint limit last.

### 10.10 Approaching vehicles (initial state, option A)

For a stop `S` and its merged arrivals `A`:
- A fresh vehicle `V` is approaching `S` if some arrival in `A` has `tripId === V.tripId`, `status === "normal"` and `time ≥ now`,
  **and** (`V.currentStopSequence` is unknown **or** the arrival's stop sequence at `S` is greater than or equal to `V.currentStopSequence`).
- Stop sequence of the arrival comes from the matched scheduled row; if unknown, rely only on the first condition.
- Order approaching vehicles like their arrivals. A vehicle appears at most once per stop.

### 10.11 Nearby

1. `findStopsNear(center, radius, nearbyMaxStops)`: bounding-box query on `stops_lat_lon`, exact haversine distance filter, sort by distance asc then id.
2. If empty: `findNearestStop(center, nearbyFallbackMaxDistanceMeters)`; if found return `[that stop]` with `outsideRadius: true`; if not found return `[]` with `outsideRadius: false`.
3. For each stop (in parallel): routes serving the stop (`route_stops`, ordered like search), merged arrivals limited to `nearbyArrivalsPerStop`, approaching vehicles (10.10).
4. Realtime snapshots are fetched **once per request** and reused for all stops.

### 10.12 Route detail and direction selection

1. Load patterns for the route (0, 1 or 2 directions). No patterns → treat as not found.
2. `directionId` given and present → use it. Given but absent → `400 invalid_request`.
3. Else, if `near` is given → choose the direction whose pattern has the stop closest to `near` (haversine); tie → `0`.
4. Else → the lowest available `directionId`.
5. Response `stops` and `shape` come from the selected pattern.

### 10.13 Route vehicles

Fresh vehicles of all feeds with `routeId` equal to the requested route, filtered by `directionId` when given, sorted by `id`.
Unknown route → `404 not_found`. Known route with no vehicles → `200` with `vehicles: []`.

### 10.14 Vehicle detail

1. Find the fresh vehicle by id across snapshots. Not found (or stale) → `404 not_found`.
2. Service date: the prediction `serviceDate` for the vehicle's trip if any; else `localServiceDate(now)`; if the trip has no scheduled stop times on that date, try the previous date.
3. Upcoming stops = scheduled stop times of the trip on that service date with `stopSequence ≥ currentStopSequence` (or all whose time `≥ now - pastArrivalGraceSeconds` when the sequence is unknown), merged with that trip's predictions using 10.9 rules 3–5, sorted by `stopSequence`.

### 10.15 Health

- Calls `getSnapshot()` on every realtime provider (uses the cache).
- `catalogVersion` from `meta.catalog_version`.
- `status: "ok"` when the catalog is readable and every feed status is `ok`; otherwise `"degraded"`.
- Catalog missing or unreadable → `status: "degraded"`, no `catalogVersion` (health never returns 503).

---

## 11. HTTP behavior (`apps/server`)

Common to every `/api/v1/*` endpoint:
- Order inside the handler: read config → authenticate → parse params → call **one** `TransitService` method → map → respond.
- Missing/invalid `API_KEY` configuration → `500 server_misconfigured` (existing behavior).
- Invalid or missing `x-api-key` → `401 unauthorized`.
- Catalog file missing or unreadable (except `/health`) → `503 catalog_unavailable`.
- Unexpected error → `500 internal_error`, logged once with `console.error` (no coordinates, no API key).
- Realtime feed failures never produce an error status; they appear as `feeds[].ok = false` and schedule-only data.
- Every handler exports `export const runtime = "nodejs";`.

| Endpoint | Params (query unless noted) | Validation → 400 | 404 when | Cache-Control |
|---|---|---|---|---|
| `GET /api/v1/stops/nearby` | `lat` (required), `lon` (required), `radius` (optional, integer meters) | `lat` ∉ [-90, 90], `lon` ∉ [-180, 180], non-numeric, `radius` not an integer in [50, 2000] | never | `no-store` |
| `GET /api/v1/search` | `q` (required) | missing, empty after normalization, longer than 50 chars | never | `private, max-age=300` |
| `GET /api/v1/stops/{stopId}/arrivals` | path `stopId` | empty or longer than 100 chars | stop not in catalog | `no-store` |
| `GET /api/v1/routes/{routeId}` | path `routeId`; `directionId` (`0`/`1`, optional); `lat` + `lon` (optional, both or none) | invalid `directionId`, only one of `lat`/`lon`, out of range | route not in catalog or without patterns | `private, max-age=300` |
| `GET /api/v1/routes/{routeId}/vehicles` | path `routeId`; `directionId` (optional) | invalid `directionId` | route not in catalog | `no-store` |
| `GET /api/v1/vehicles/{vehicleId}` | path `vehicleId` | empty or longer than 100 chars | vehicle not found or stale | `no-store` |
| `GET /api/v1/health` | — | — | never | `no-store` |
| `GET /api/cron/rebuild-catalog` | header `authorization: Bearer <CRON_SECRET>` | — | — | `no-store` |

Cron route behavior:
- Missing `CRON_SECRET` or `CATALOG_DEPLOY_HOOK_URL` → `500 server_misconfigured`.
- Header mismatch (constant-time comparison, reuse the hashing helper from `auth.ts`) → `401 unauthorized`.
- Otherwise `POST` to `CATALOG_DEPLOY_HOOK_URL` (timeout 10 s). Success → `200 { "triggered": true }`. Hook failure → `502` with `ApiErrorBody` code `internal_error`.
- This route does not require `x-api-key`.

Handler structure (dependency injection, same pattern for every endpoint):
- `apps/server/src/handlers/<name>-handler.ts` exports a factory, e.g.
  `export function createStopArrivalsHandler(deps: { getService: () => TransitService; readConfig: () => ServerConfigResult })`
  returning `(request: Request, context: RouteContext) => Promise<Response>`.
- The route file only wires production dependencies:
  `export const GET = createStopArrivalsHandler({ getService: getTransitService, readConfig: readServerConfig });`
- Tests call the factory with a service built from fakes. Do not use module mocking (`vi.mock`) for handlers.
- Migrate the existing health route to this pattern.

Composition root (`apps/server/src/composition/transit-service.ts`):
- `getTransitService()` builds the service lazily on first use and reuses it for the lifetime of the function instance.
  This single memoized instance is the only allowed module-level state; it lives only in the composition root.
- The SQLite database is opened once per instance, read-only, from `CATALOG_PATH` or `path.join(process.cwd(), "generated/catalog.sqlite")`.

Mappers (`apps/server/src/mappers/`): one file per DTO family, pure functions, unit-tested.
`routeShortName` in DTOs falls back to `longName` when `shortName` is empty.

---

## 12. Fixtures

Raw inputs already exist locally (git-ignored) in `data/raw/` — see `data/raw/README.md` for sources and capture times:

```
data/raw/metrotransit/gtfs/*.txt                               (unzipped static feed)
data/raw/metrotransit/vehicle-positions-2026-09-16T1738.pb      header 1789598304
data/raw/metrotransit/trip-updates-2026-09-16T1739.pb           header 1789598336
data/raw/mvta/gtfs.zip
data/raw/mvta/vehicle-positions-2026-09-16T1720.pb              header 1789597197
data/raw/mvta/trip-updates-2026-09-16T1723.pb                   header 1789597408
```

If `data/raw/` is missing, **stop and ask** the user to provide the files. Do not download replacements: the fixtures must match these captures.

Fixture generator: `packages/gtfs/scripts/make-fixtures.ts` (run with `tsx`), committed together with its output.

- **Selection (data selection only, not logic):** Metro Transit route `54`; MVTA route `436`.
- Static fixtures (`packages/gtfs/test/fixtures/<feedId>/gtfs/*.txt`): `agency`, `routes` (selected routes), `trips` of those routes,
  their `stop_times`, the referenced `stops`, `shapes`, `calendar`/`calendar_dates` rows for referenced services, `feed_info`.
- Realtime fixtures (`packages/gtfs/test/fixtures/<feedId>/*.pb`): decode the raw file, keep the header and only entities whose trip belongs to the selected routes, re-encode.
- Each fixture folder gets a `SOURCE.md` with the raw file name, capture time and selection.
- Total fixture size must stay under 3 MB.

---

## 13. Tasks

Execute in order. Check each box when its acceptance criteria pass. Commit after each task with the given message
(Conventional Commits, English). Run `pnpm verify` before every commit.

### Phase A — Foundations

- [x] **E001-T01 — Dependencies and scripts**
  - `packages/gtfs/package.json`: add dependencies `gtfs-realtime-bindings`, `fflate`, `csv-parse`; devDependencies `tsx`, `@types/node@^24`.
  - `apps/server/package.json`: add dependencies `@transit/core` and `@transit/gtfs` (`workspace:*`); devDependencies `tsx`; set `@types/node` to `^24`; add `"engines": { "node": "24.x" }`.
  - Root `.gitignore`: add `apps/server/generated/`.
  - Run `pnpm install` (on the developer machine).
  - Acceptance: `pnpm verify` passes; `node -e "require('node:sqlite')"` works on Node 24.
  - Commit: `build(repo): add dependencies for transit data api`

- [x] **E001-T02 — Core model, ports and settings**
  - Apply sections 7.1, 7.2 and the `TransitSettings` interface (7.3). Update existing usages (`Stop.agencyIds` → `feedIds`, `Freshness` → `FeedStatus`).
  - Acceptance: `pnpm typecheck` passes; no Biome boundary violations.
  - Commit: `feat(core): extend transit model and ports for data api`

- [x] **E001-T03 — Contracts and API client**
  - Apply section 8 to `@transit/contracts`.
  - `@transit/api-client`: add `getNearbyStops({ lat, lon, radius? })`, `search(q)`, `getStopArrivals(stopId)`, `getRouteDetail(routeId, { directionId?, lat?, lon? })`, `getRouteVehicles(routeId, { directionId? })`, `getVehicleDetail(vehicleId)`; keep `getHealth()`. Path params encoded with `encodeURIComponent`; omit undefined query params.
  - Tests (`packages/api-client/src/index.test.ts`, fake `fetch`): URL building for every method, `x-api-key` header, error mapping to `ApiError`.
  - Commit: `feat(contracts): define v1 transit endpoints and client methods`

- [x] **E001-T04 — Fixtures**
  - Implement section 12. Commit the script and generated fixtures.
  - Acceptance: fixtures exist for both feeds, total < 3 MB, each with `SOURCE.md`.
  - Commit: `test(gtfs): add real feed fixtures for metrotransit and mvta`

### Phase B — Static catalog (`@transit/gtfs`)

- [x] **E001-T05 — Time helpers**
  - `src/time/gtfs-time.ts`: `parseGtfsTime`, `epochFor`, `localServiceDate`, `addDays(serviceDate, n)` (section 10.1).
  - Tests: the four cases of 10.1, invalid time string.
  - Commit: `feat(gtfs): add gtfs time and service date helpers`

- [x] **E001-T06 — GTFS source reading**
  - `src/static/gtfs-source.ts`: `interface GtfsSource { hasFile(name): boolean; readRows(name): AsyncIterable<Record<string, string>> }`.
  - Implementations: `createZipGtfsSource(bytes: Uint8Array)` (fflate `unzipSync`, strip UTF-8 BOM) and `createDirectoryGtfsSource(dirPath)` (for fixtures and local raw data).
  - CSV parsing with `csv-parse` (`columns: true`, `bom: true`, `skip_empty_lines: true`, `relax_column_count: true`).
  - `src/static/download-feed.ts`: `downloadStaticFeed(url, { userAgent, timeoutMs: 120000, fetchImpl })` → `Uint8Array`; non-2xx → throw with URL and status.
  - Tests: both sources read fixture rows identically; BOM handling.
  - Commit: `feat(gtfs): read gtfs feeds from zip archives and directories`

- [x] **E001-T07 — Catalog builder**
  - `src/static/build-catalog.ts`: `buildCatalog({ feeds: Array<{ config: FeedConfig; source: GtfsSource }>, outputPath, now: EpochSeconds, settings })`.
  - Implements sections 9 and 10.2–10.5 and the FTS tables; writes to `${outputPath}.tmp` then renames.
  - `catalog_version` = `${ISO build time}|${feedId}=${feed_version or "unknown"},...`.
  - Logs per feed: rows imported per table and duration.
  - Tests (build into a temp dir from fixtures, `now` = 1789597408):
    - service dates: a service from `calendar.txt` and one added/removed by `calendar_dates.txt`;
    - shared stop `56939` exists once with both feeds in `stop_feeds` and Metro Transit's name;
    - a trip time ≥ 24:00:00 is stored as seconds > 86400;
    - representative pattern for `mvta:436` direction `1` ends at "Eagan Transit Station";
    - non-boarding stops (`location_type` ≠ 0) are not imported;
    - interpolation of a synthetic blank stop time (small in-test fixture).
  - Commit: `feat(gtfs): build sqlite catalog from gtfs static feeds`

- [x] **E001-T08 — SQLite catalog provider**
  - `src/catalog/sqlite-catalog-provider.ts`: `createSqliteCatalogProvider({ databasePath })` implementing `CatalogProvider` with `node:sqlite` `DatabaseSync(path, { readOnly: true })` and prepared statements created once.
  - Scheduled queries use the service dates of the local days covering `[from, to]` plus the previous day (for times ≥ 24:00:00), converting with `epochFor`.
  - Throws `CatalogUnavailableError` (exported) when the file is missing or unreadable.
  - Tests against a catalog built from fixtures: nearby stops near MSP Terminal 1 (44.880248, -93.204865) returns `56939` first; `searchRoutes("436")`; `searchStops("terminal 1")`; `getRoutePatterns("mvta:436")` returns 2 directions; scheduled stop times at `56939` for a window around 1789597408 are sorted and within range; `getTrip` for a known and unknown id.
  - Commit: `feat(gtfs): query the catalog with node sqlite`

### Phase C — Realtime (`@transit/gtfs`)

- [x] **E001-T09 — GTFS-RT normalization**
  - `src/realtime/normalize-vehicle-positions.ts` and `normalize-trip-updates.ts`: pure functions `(feedMessage, { feedId, tripLookup })` implementing 10.7, where `tripLookup` exposes `getTrip` and `getScheduledStopTimesForTrip`.
  - Tests with fixtures:
    - MVTA vehicles: `directionId` resolved from the catalog (the feed has none);
    - Metro Transit vehicles: entities without position are dropped and duplicates are removed;
    - Metro Transit trip updates: a `SKIPPED` update → `status: "skipped"`; a `CANCELED` trip (use a synthetic message if the fixture has none) → canceled predictions; `NO_DATA` skipped; past updates dropped;
    - `departure.time` used when `arrival` is absent.
  - Commit: `feat(gtfs): normalize gtfs realtime vehicle positions and trip updates`

- [x] **E001-T10 — Realtime provider**
  - `src/realtime/gtfs-realtime-provider.ts`: `createGtfsRealtimeProvider({ feed: FeedConfig, catalog, cache, clock, settings, fetchImpl })` implementing 10.8.
  - Tests with a fake fetch and fake clock: cache hit within 20 s; refetch after TTL; single-flight (two concurrent calls → one fetch per URL); partial failure → `ok: false` with the successful part; total failure → empty and `ok: false`; timeout honored.
  - Commit: `feat(gtfs): add cached gtfs realtime provider`

### Phase D — Domain (`@transit/core`)

- [x] **E001-T11 — Pure domain functions**
  - Files in `packages/core/src/domain/`: `geo.ts` (haversine, bounding box), `freshness.ts` (10.8 stale rules), `merge-arrivals.ts` (10.9), `approaching-vehicles.ts` (10.10), `direction.ts` (10.12 selection), `search.ts` (10.6 normalization, ranking, variant suffix rule), `natural-order.ts`.
  - Tests: one `describe` per rule in sections 10.6, 10.8–10.10 and 10.12, with in-memory data (no fixtures needed).
  - Commit: `feat(core): add arrival merge, freshness and ranking rules`

- [x] **E001-T12 — TransitService**
  - `packages/core/src/transit-service.ts` implementing 7.3 and 10.11–10.15 on top of the ports and domain functions.
  - Realtime snapshots are fetched once per use-case call with `Promise.all` over providers (providers never throw).
  - Tests with fake catalog, fake providers and fake clock covering: nearby with and without stops in radius; stop arrivals mixing live and scheduled; unknown stop → `undefined`; route detail direction selection by `near`; vehicle detail upcoming stops; health degraded when one feed is not ok.
  - Commit: `feat(core): implement transit service use cases`

### Phase E — Server (`apps/server`)

- [x] **E001-T13 — Configuration, infrastructure adapters and composition root**
  - `src/config/feeds.ts` (6.1), `src/config/transit-settings.ts` (6.2), extend `src/config/server-config.ts` with optional `cronSecret`, `catalogDeployHookUrl`, `catalogPath`.
  - `src/infrastructure/in-memory-cache.ts` (`Cache` with expiry), `src/infrastructure/system-clock.ts`.
  - `src/composition/transit-service.ts` (section 11).
  - Tests: in-memory cache expiry with a fake clock; server config parsing of the new variables.
  - Commit: `feat(server): wire transit service with catalog and realtime providers`

- [x] **E001-T14 — HTTP helpers and mappers**
  - `src/http/params.ts`: `parseLatLon`, `parseRadius`, `parseDirectionId`, `parseSearchQuery`, `parsePathId` returning `{ ok: true, value } | { ok: false, message }`.
  - `src/http/responses.ts`: add `CATALOG_CACHE = "private, max-age=300"`, map `catalog_unavailable` → 503.
  - `src/http/handle-api-request.ts`: shared wrapper that runs config check, auth, catches `CatalogUnavailableError` → 503 and unknown errors → 500.
  - `src/mappers/*.ts`: domain → contracts.
  - Tests for every parser boundary value in section 11 and for each mapper.
  - Commit: `feat(server): add request parsing, error handling and dto mappers`

- [x] **E001-T15 — Endpoints**
  - Route files:
    - `app/api/v1/stops/nearby/route.ts`
    - `app/api/v1/search/route.ts`
    - `app/api/v1/stops/[stopId]/arrivals/route.ts`
    - `app/api/v1/routes/[routeId]/route.ts`
    - `app/api/v1/routes/[routeId]/vehicles/route.ts`
    - `app/api/v1/vehicles/[vehicleId]/route.ts`
    - update `app/api/v1/health/route.ts` to use `TransitService.getHealth()`.
  - Check the dynamic route params signature in `node_modules/next/dist/docs/` (Next.js 16) before writing handlers.
  - Handlers follow the factory pattern in section 11 (`src/handlers/*-handler.ts`); route files only wire production dependencies.
  - Tests per endpoint: 200 happy path, 400 validation, 401, 404 where applicable, 503 when the catalog is unavailable, headers per section 11.
  - Commit: `feat(server): add v1 transit endpoints`

- [x] **E001-T16 — Catalog build script and Vercel configuration**
  - `apps/server/scripts/build-catalog.ts`: for each feed in `FEEDS` download the static zip, build with `buildCatalog`, output `generated/catalog.sqlite`. Flag `--source=raw` builds from `../../data/raw` instead of downloading (Metro Transit from the directory, MVTA from `gtfs.zip`).
  - `apps/server/package.json` scripts: `"catalog:build": "tsx scripts/build-catalog.ts"`, `"catalog:build:raw": "tsx scripts/build-catalog.ts --source=raw"`, `"build": "pnpm run catalog:build && next build"`.
  - `apps/server/next.config.ts`: `outputFileTracingIncludes: { "/api/**": ["./generated/catalog.sqlite"] }`. Verify the key pattern against the Next.js 16 docs in `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/output.md`.
  - Cron endpoint: `src/handlers/rebuild-catalog-handler.ts` (factory with injected `fetchImpl`) wired in `app/api/cron/rebuild-catalog/route.ts` (section 11). Tests with a fake fetch: 401, 500 misconfigured, 200 triggered, 502 hook failure.
  - `apps/server/vercel.json`:
    ```json
    {
      "$schema": "https://openapi.vercel.sh/vercel.json",
      "crons": [{ "path": "/api/cron/rebuild-catalog", "schedule": "0 9 * * *" }]
    }
    ```
    (09:00 UTC ≈ 04:00 America/Chicago; Hobby runs it within that hour.)
  - Update `apps/server/README.md`: environment variables, catalog commands, cron, manual Vercel setup (section 14).
  - Acceptance: `pnpm --filter @transit/server catalog:build:raw` produces the catalog and logs row counts; `pnpm --filter @transit/server build` succeeds and lists every endpoint as dynamic (`ƒ`).
  - Record in the change description: catalog file size, build duration, and cold first-request latency of `/api/v1/stops/nearby` locally.
  - Commit: `build(server): build catalog before next build and schedule daily rebuild`

### Phase F — Closing

- [x] **E001-T17 — End-to-end local verification**
  - Run section 15 checks with the real catalog (`catalog:build`, live network) and record results in the change description.
  - Commit: none unless fixes are needed (`fix(<scope>): ...`).

- [x] **E001-T18 — Documentation**
  - Update `docs/engineering/architecture.md` (catalog storage, realtime cache, ids), `docs/engineering/server.md` (folder structure, cron route), `docs/epics/README.md` (status `Done`).
  - List in the final summary the decisions this epic introduced (section 3, second table) so the project decisions document can be updated.
  - Commit: `docs(repo): document transit data api architecture`

---

## 14. Manual steps for the human (the agent must not attempt these)

1. Create the Vercel project with **Root Directory** `apps/server`, framework Next.js, Node.js 24.
2. Environment variables (Production): `API_KEY`, `CRON_SECRET` (random, ≥ 16 chars), `CATALOG_DEPLOY_HOOK_URL`.
3. Create a Deploy Hook for branch `main` (Project Settings → Git → Deploy Hooks) and store its URL in `CATALOG_DEPLOY_HOOK_URL`.
4. Deploy and check `/api/v1/health` and the Cron Jobs page.

---

## 15. Verification

Automated:

```bash
pnpm verify
pnpm --filter @transit/server catalog:build
pnpm --filter @transit/server build
```

Manual (local, `pnpm --filter @transit/server dev`, key `change-me`):

```bash
H='x-api-key: change-me'; B=http://localhost:3000/api/v1

curl -s -H "$H" "$B/health"                                   # status ok, 2 feeds ok, catalogVersion present
curl -s -H "$H" "$B/stops/nearby?lat=44.880248&lon=-93.204865" # 56939 first, arrivals with source live/scheduled
curl -s -H "$H" "$B/search?q=436"                             # mvta:436 first
curl -s -H "$H" "$B/search?q=436V"                            # variant suffix rule → mvta:436
curl -s -H "$H" "$B/search?q=terminal%201"                    # MSP Terminal 1 Transit Station
curl -s -H "$H" "$B/stops/56939/arrivals"                     # sorted, ≤ 30, live when vehicles report
curl -s -H "$H" "$B/routes/mvta%3A436?lat=44.880248&lon=-93.204865"   # directions, ordered stops, shape
curl -s -H "$H" "$B/routes/mvta%3A436/vehicles"               # fresh vehicles only (≤ 120 s old)
curl -s -H "$H" "$B/vehicles/<id from previous call>"         # upcoming stops ordered by sequence
curl -s -i "$B/search?q=436"                                  # 401
curl -s -i -H "$H" "$B/stops/nearby?lat=999&lon=0"            # 400 invalid_request
curl -s -i -H "$H" "$B/routes/unknown%3A1"                    # 404 not_found
```

Expected realtime results depend on the time of day; outside service hours, arrivals may be only `scheduled` and vehicle lists empty. That is correct behavior.

---

## 16. Risks and stop conditions

The agent must **stop and ask** (not work around) when:
- A feed URL returns non-2xx or unexpected content (e.g. the MVTA realtime URL returning 404 without a browser-like request).
- `node:sqlite` is unavailable or behaves differently on Node 24 or on Vercel.
- The catalog file exceeds **150 MB** or the build exceeds **10 minutes** on the developer machine.
- A rule in section 10 cannot be implemented as written with the real data.
- Satisfying a test would require agency-, route- or stop-specific code.
- A new dependency, endpoint, contract field or setting not listed here seems necessary.
- `pnpm verify` cannot be made to pass without weakening TypeScript or Biome rules.

Known risks (handled by design):
- Feed down during the daily build → build fails, previous deployment stays live.
- Feed down at request time → schedule-only data with `feeds[].ok = false`.
- `node:sqlite` prints an experimental warning on some Node 24 versions → acceptable; do not suppress globally.
- In-memory cache is per function instance → occasional extra downloads are acceptable.

