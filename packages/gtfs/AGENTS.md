# @transit/gtfs

Adapters for GTFS static and GTFS-Realtime. Node.js only. Read `docs/engineering/architecture.md`.

- Implements `CatalogProvider` and `RealtimeProvider` from `@transit/core`; exports factories, not globals.
- Translate raw feed data into the canonical model **inside** this package; raw feed types never leave it.
- Only **generic** GTFS / GTFS-RT rules. Document each rule with a short "why" comment.
  A rule that only applies to one route is not allowed.
- Network and file access are injected (e.g. a fetcher function), so adapters are testable offline.
- Tests use small real fixtures in `test/fixtures` (document source agency and capture date).
- Be mindful of large inputs (Metro Transit TripUpdate ~900 KB, `stop_times.txt` ~45 MB): stream or index,
  but measure before optimizing.
