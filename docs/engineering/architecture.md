# Architecture

## Style

Ports and adapters (hexagonal architecture) with a canonical domain model and an
anti-corruption layer around every external data source.

```
apps/mobile (Expo)                     labels in Spanish via i18n
      │  HTTPS + JSON (@transit/contracts)
apps/server (Next.js route handlers)   transport + composition root
      │
TransitService (@transit/core)         use cases: one per UI query
      │
Merger (@transit/core)                 combines catalog + realtime, live > scheduled
      │
Ports (@transit/core)                  CatalogProvider, RealtimeProvider, Clock, Cache...
      ▲
Adapters (@transit/gtfs, future)       GTFS static, GTFS-Realtime
      │
AgencyRegistry (server config)         which adapters and URLs each agency uses
```

## The dependency rule

- Source code dependencies point **inward**: adapters and apps depend on `core`, never the reverse.
- `core` defines interfaces (ports). Adapters implement them. The server wires them together.
- Anything that performs I/O (network, file system, clock, randomness, cache) is behind a port.

## Use cases (TransitService)

One method per query the UI needs. Do not add use cases that are not backed by a decided screen or flow.
Implemented in `packages/core/src/transit-service.ts` (`createTransitService`); see EPIC-001 for the full
per-use-case algorithm.

| Use case | Screen |
|---|---|
| `getNearby(center, radiusMeters)` | Nearby (initial state) |
| `search(query)` | Search (routes and stops) |
| `getStopArrivals(stopId)` | Stop |
| `getRouteDetail(routeId, options)` | Route |
| `getRouteVehicles(routeId, directionId?)` | Route / Nearby |
| `getVehicleDetail(vehicleId)` | Vehicle |
| `getHealth()` | Diagnostics / `/api/v1/health` |

`TransitServiceDeps` also takes `feeds: FeedConfig[]` (beyond `catalog`, `realtime`, `clock`, `settings`),
so the service can resolve each feed's IANA time zone when computing a fallback service date for
`getVehicleDetail` — see "Ids and service dates" below.

## Canonical model rules

- Defined in `packages/core/src/model.ts`. Adapters translate **into** it; nothing downstream reads raw feeds.
- Route and trip ids are prefixed with the agency id (`mvta:436`).
- Stops use the regional `stop_id`; the same `stop_id` from two agencies is one stop.
- Times in the domain are **Unix epoch seconds**. Convert GTFS local times (which can exceed `24:00:00`)
  inside the adapter, using the agency time zone.
- Changing the model is a deliberate change: update all adapters, the mappers to contracts, and tests together.

## Adapters

- One adapter per **standard or source type**, never per route.
- Adapters declare `ProviderCapabilities`; the Merger decides based on capabilities, not on agency names.
- GTFS-Realtime normalization rules (generic, verified with MVTA and Metro Transit):
  - Direction: use `direction_id` from the feed; otherwise look it up in `trips.txt`.
  - Vehicles: drop entities without a position (lat/lon = 0); deduplicate by `vehicle.id`.
  - Arrival time: `arrival.time`, falling back to `departure.time`.
  - Drop stop time updates earlier than the feed timestamp.
  - `NO_DATA` → schedule; `SKIPPED` → status `skipped`; trip `CANCELED` → status `canceled`.
  - Do not expose `current_status` to the UI.
- Adding an agency = adding configuration (URLs, adapter type, priority). If it needs code, the adapter is
  missing a generic capability — add it generically.

## Merger rules

- A `live` arrival replaces the `scheduled` arrival of the same trip at the same stop.
- If realtime fails or is stale (threshold in configuration), fall back to schedule. Never fail the whole request.
- Source priority per agency comes from configuration, never from `if (agency === ...)`.

## Catalog storage

- The static catalog (agencies, routes, stops, shapes, calendar, patterns) is a **SQLite file**
  (`node:sqlite`, read-only at request time), built ahead of time — never inside a request.
- `apps/server/scripts/build-catalog.ts` builds it from each configured feed (`FEEDS`), either by
  downloading the static zip or, with `--source=raw`, from the checked-out `data/raw/` fixtures
  (no network). It writes `apps/server/generated/catalog.sqlite` and logs each feed's row counts and
  build duration (`buildCatalog()` itself does not log).
- `apps/server/package.json`'s `build` script runs `catalog:build` before `next build`, so the file
  exists when Next.js traces the deployment bundle. `next.config.ts` sets
  `outputFileTracingIncludes: { "/api/**": ["./generated/catalog.sqlite"] }` so the catalog is included
  in every API route function's bundle (paths there resolve relative to `apps/server`, the Next.js
  project root in this monorepo).
- Vercel keeps serving the previous deployment if a build fails (e.g. a feed download fails), so a bad
  feed never takes the API down.
- `SqliteCatalogProvider` (`@transit/gtfs`) opens the file once per function instance, read-only, from
  `CATALOG_PATH` or `path.join(process.cwd(), "generated/catalog.sqlite")` by default (see
  `apps/server/src/composition/transit-service.ts`).
- A daily Vercel cron (`vercel.json`, 09:00 UTC) hits `GET /api/cron/rebuild-catalog`, which is
  authenticated with a bearer `CRON_SECRET` (not `x-api-key`) and simply POSTs to
  `CATALOG_DEPLOY_HOOK_URL` to trigger a fresh build/deploy — the rebuild itself always happens at
  build time, never inside a running function.

## Realtime cache

- `InMemoryCache` (`apps/server/src/infrastructure/in-memory-cache.ts`) is a plain `Map` keyed by cache
  key, storing `{ value, expiresAt }`, driven by the injected `Clock` (never `Date.now()` directly).
- One cache instance is created in the composition root and shared across every feed's
  `GtfsRealtimeProvider`, with a `realtimeCacheTtlSeconds: 20` TTL (`TRANSIT_SETTINGS`). Data older than
  `realtimeStaleAfterSeconds: 120` is treated as stale and the merger falls back to schedule.
- The cache lives only as long as the function instance (no background workers, no shared state across
  instances) — see "Serverless constraints" below. Occasional extra downloads on a cold instance are
  acceptable by design.

## Ids and service dates

- Route, trip and vehicle ids are prefixed with the owning feed id (`FeedConfig.id`), e.g. `mvta:436`.
  Stop ids are the regional `stop_id` as-is: the same `stop_id` reported by two feeds is one stop
  (`Stop.feedIds` lists every feed that serves it).
- `ServiceDate` is `YYYYMMDD` in the feed's own IANA time zone (`FeedConfig.timezone`), computed with
  `localServiceDate`/`addDays` (`packages/core/src/domain/service-date.ts` — moved there from
  `@transit/gtfs` because they are generic calendar helpers, not GTFS-specific, and `core` cannot depend
  on `gtfs`). `getVehicleDetail` uses this to compute a fallback service date per feed when the realtime
  feed itself does not report one.

## Serverless constraints (Vercel)

- No background workers. Realtime feeds are fetched on demand and cached for a short TTL.
- **No hidden module-level mutable state.** Caching is a port (`Cache`) with an in-memory implementation
  wired in the composition root, so it can be replaced (e.g. Redis) and faked in tests.
- Keep heavy work (catalog building) out of request handlers.

## API contracts

- Public shapes live in `@transit/contracts`, versioned under `/api/v1`.
- The server maps domain objects to contract objects in dedicated mapper functions.
- Additive changes (new optional fields) are allowed in v1. Removing or renaming fields requires a new version.
- Errors use `ApiErrorBody` with a stable `code`.
