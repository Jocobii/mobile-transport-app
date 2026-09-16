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

| Use case | Screen |
|---|---|
| `getNearbyStops(location, radiusMeters)` | Nearby (initial state) |
| `search(query)` | Search (routes and stops) |
| `getArrivals(stopId)` | Stop |
| `getRouteDetail(routeId, directionId)` | Route |
| `getVehicles(routeId, directionId?)` | Route / Nearby |
| `getVehicleDetail(vehicleId)` | Vehicle |

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
