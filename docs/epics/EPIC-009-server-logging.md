# EPIC-009 — Server logging (errors, requests, feeds, catalog build)

| Field | Value |
|---|---|
| Status | Ready |
| Depends on | EPIC-001 Done. Independent of EPIC-006/007/008 (touches only `apps/server`, `@transit/core` ports and `@transit/gtfs` adapters). |
| Related decisions | Project doc `claude/logging-servidor.md` (2026-09-27). User, 2026-09-27: logs go to **stdout only** (free; viewed live in Vercel, Hobby keeps them ~1 h); **server only**; the catalog events that matter are the **GTFS static download / catalog build** and the **live feed downloads**; errors first. |
| Read first | `AGENTS.md`, `docs/engineering/architecture.md`, `principles.md`, `server.md`, `typescript.md`, `testing.md`, `workflow.md` (sections "Security and privacy" and "Logging"), `apps/server/AGENTS.md` |

---

## 1. Goal

Know what the server is doing without attaching a debugger: every error with enough context to fix it,
every API request with its status and duration, every live-feed download failure, and a readable record
of each catalog build (which feed was downloaded, how big, how long, what failed).

Today the server has four ad-hoc `console.*` calls, the realtime provider **swallows feed errors in
silence** (`fetchOne` → `catch { return undefined }`), and the catalog build prints free text.

### Definition of success
1. Every line the server writes is one JSON object with `ts`, `level`, `event` and flat fields.
2. Every `/api/v1/**` request produces exactly one `http.request` line (method, path without query,
   status, duration, Vercel request id). Unexpected errors add one `http.unhandled_error` line with the
   stack.
3. A failed VehiclePosition/TripUpdate download is logged with feed id, kind, reason, HTTP status and
   duration. Serving the last good snapshot or an empty one because of it is logged too.
4. The catalog build logs start, each feed download (bytes, duration), each feed import (row counts),
   completion (version, file size, duration) or the failure with its cause. The daily cron logs whether
   it triggered the deploy hook.
5. No coordinates, API key, `CRON_SECRET` or deploy hook URL ever appear in a log line (tested).
6. No new dependency. `pnpm verify` passes.

---

## 2. Scope

### In scope
- A `Logger` port in `@transit/core` and a stdout JSON adapter in `apps/server`.
- `LOG_LEVEL` environment variable (optional).
- Request and error logging in `handleApiRequest`.
- Live feed logging in `@transit/gtfs` (`GtfsRealtimeProvider`, `downloadStaticFeed`).
- Catalog build script and rebuild cron logging.
- Migrating the existing `console.*` calls and `realtime.lag` to the logger.
- Docs: new `docs/engineering/logging.md` (event catalog), updates to `server.md`, `architecture.md`, `workflow.md`.

### Out of scope (do not implement)
- Any external log service, Vercel Log Drains, Sentry, OpenTelemetry, metrics or alerts — possible future epic.
- Logging in the mobile app or in `@transit/api-client`.
- Next.js `instrumentation.ts` / `onRequestError`.
- Logging inside pure domain code (`@transit/core` functions, mappers). Only boundaries log (`workflow.md`).
- Logging the opening of `catalog.sqlite` on cold start (not requested; its failure is still covered by
  `http.catalog_unavailable`).
- Changing any response, status code, cache header or `@transit/contracts` shape.
- Retries, timeouts or fallback behavior changes. This epic only observes.

---

## 3. Decisions this epic relies on

**Decided by the user (2026-09-27)**

| Topic | Value |
|---|---|
| Destination | stdout (Vercel runtime/build logs). Free. No external service for now. |
| Reach | Server only. |
| Catalog events | GTFS static download + catalog build (build time, cron); live feed downloads (request time). |
| Priority | Errors first, then requests. |

**Proposed by Claude (architect/PO) and included here; change before executing if you disagree**

| Topic | Value |
|---|---|
| Shape | Behind a `Logger` port so an external sink can be added later as another adapter, without touching handlers or adapters. |
| Format | One JSON line per event, always (also locally). `ts` ISO-8601 UTC, `level`, `event` (dotted, `area.what`), then flat fields. Reserved keys `ts`, `level`, `event` cannot be overwritten by fields. |
| Levels | `debug` < `info` < `warn` < `error`. `LOG_LEVEL` env var, default `info`; an unknown value falls back to `info`. `error`/`warn` go to `console.error`/`console.warn`, `info`/`debug` to `console.log` (so Vercel shows the right level). |
| Request level | `info` for status < 400, `warn` for 4xx, `error` for 5xx. |
| Request id | `x-vercel-id` request header when present, else omitted. No id generation. |
| Path | `URL.pathname` only. The query string is **never** logged (it carries `lat`, `lon`, `bbox`). |
| Errors | Serialized as `{ name, message, stack, cause? }` (cause one level deep). |
| Feed URLs | Public feed URLs may be logged. The deploy hook URL may **not** (it is a secret). |
| Cache hits | Per-request realtime source (`cache` / `last_good` / `fresh`) is `debug` only, off by default. |

---

## 4. Technical specification

### 4.1 Port (`packages/core/src/ports.ts`)

```ts
export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;

/** Structured log sink. Implemented by the server; adapters receive it injected. */
export interface Logger {
  debug(event: string, fields?: LogFields): void;
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
}
```

`packages/core/src/logging.ts` exports `NOOP_LOGGER: Logger` (every method does nothing), re-exported
from `src/index.ts`. Core itself never calls a logger. A logger never throws.

### 4.2 Stdout adapter (`apps/server/src/infrastructure/console-logger.ts`)

```ts
export interface ConsoleLoggerOptions {
  minLevel: LogLevel;
  /** Injected for tests; defaults to `new Date().toISOString()`. */
  now?: () => string;
  /** Injected for tests; defaults to console.log / console.warn / console.error by level. */
  write?: (level: LogLevel, line: string) => void;
}
export function createConsoleLogger(options: ConsoleLoggerOptions): Logger;
export function parseLogLevel(value: string | undefined): LogLevel; // default "info"
export function serializeError(err: unknown): { name: string; message: string; stack?: string; cause?: unknown };
```

- Line = `JSON.stringify({ ...fields, ts, level, event })` with reserved keys last. Any field whose value
  is an `Error` (at the top level) goes through `serializeError`. Non-serializable values (cycles,
  `BigInt`) must not throw: fall back to `{ ts, level, event, logError: "unserializable fields" }`.
- `LOG_LEVEL` is read in `server-config.ts` (`logLevel`, optional, pure parser, tested) — it is not
  required, so a missing value never makes the server misconfigured.
- `apps/server/src/composition/logger.ts`: `getLogger()` returns one stateless logger built from the
  config (memoized like `getTransitService`). This is the only place the adapter is instantiated.
- Delete `src/infrastructure/log-realtime-lag.ts`; the composition root wires
  `onLagSample: (sample) => logger.info("realtime.lag", { ...sample })` and passes `logger` to every
  `GtfsRealtimeProvider`.

### 4.3 Requests and errors (`apps/server/src/http/handle-api-request.ts`)

`HandleApiRequestDeps` gains `logger: Logger` and optional `nowMs?: () => number` (default
`performance.now`). Every handler deps interface that extends/uses it gets `logger`; every
`app/api/v1/**/route.ts` passes `logger: getLogger()`.

Events (fields beyond these are not allowed):

| Event | Level | Fields | When |
|---|---|---|---|
| `http.request` | by status (§3) | `requestId?`, `method`, `path`, `status`, `durationMs` (integer) | Always, once, after the response is known — including 401/500 early returns. |
| `http.unhandled_error` | error | `requestId?`, `method`, `path`, `error` | Any thrown error that is not `CatalogUnavailableError` (replaces the current `console.error`). |
| `http.catalog_unavailable` | error | `requestId?`, `path`, `error` | `CatalogUnavailableError` caught. |
| `server.misconfigured` | error | `missing` (array of env var **names**) | Config invalid. |

`durationMs` measures from entering `handleApiRequest` to the `Response` being ready (not streaming).

### 4.4 Live feeds (`@transit/gtfs`)

`download-feed.ts`: throw a new exported `FeedDownloadError extends Error` with
`readonly reason: "http_status" | "timeout" | "network"`, `readonly httpStatus?: number`, `readonly url`.
The message stays as today for `http_status`. An aborted fetch → `timeout`; any other fetch rejection →
`network` (original error as `cause`). Existing callers keep working (it is still an `Error`).

`CreateGtfsRealtimeProviderOptions` gains `logger?: Logger` (default `NOOP_LOGGER`) and
`nowMs?: () => number` (default `performance.now`).

| Event | Level | Fields | When |
|---|---|---|---|
| `realtime.fetch_failed` | warn | `feedId`, `kind` (`vehicle_positions` \| `trip_updates`), `url`, `reason` (`http_status` \| `timeout` \| `network` \| `decode`), `httpStatus?`, `durationMs`, `error` | One feed URL failed (download or protobuf decode). Replaces the silent `catch`. |
| `realtime.refresh` | info | `feedId`, `ok`, `vehiclesOk`, `tripsOk`, `vehicleCount`, `predictionCount`, `durationMs` | Every snapshot rebuild that reached the network (about every `realtimeCacheTtlSeconds` per warm instance). |
| `realtime.unavailable` | warn | `feedId`, `servedLastGood` (boolean) | Both URLs failed; says whether the last good snapshot or an empty one is served. |
| `realtime.refresh_failed` | error | `feedId`, `error` | The background (stale-while-revalidate) refresh rejected — today `.catch(() => undefined)`. |
| `realtime.snapshot_served` | debug | `feedId`, `source` (`cache` \| `last_good` \| `fresh`) | Each `getSnapshot` call. |
| `realtime.lag` | info | unchanged `RealtimeLagSample` fields | Unchanged, now through the logger. |

The provider still never throws and its returned snapshots are byte-for-byte the same as before.

### 4.5 Catalog build and cron

Move the orchestration out of `scripts/build-catalog.ts` into
`apps/server/src/catalog/run-catalog-build.ts` so it is testable:

```ts
export interface RunCatalogBuildDeps {
  feeds: readonly FeedConfig[];
  source: "download" | "raw";
  loadFeed: (feed: FeedConfig) => Promise<BuildCatalogFeedInput & { bytes?: number }>;
  build: typeof buildCatalog;
  statFile: (path: string) => { size: number };
  logger: Logger;
  nowMs: () => number;
  nowEpochSeconds: () => number;
  outputPath: string;
}
export async function runCatalogBuild(deps: RunCatalogBuildDeps): Promise<void>; // rethrows on failure
```

The script keeps only wiring (raw vs. download, paths, `process.exitCode = 1` on failure) and uses
`createConsoleLogger` with `minLevel` from `LOG_LEVEL`.

| Event | Level | Fields |
|---|---|---|
| `catalog.build.started` | info | `source`, `feedCount` |
| `catalog.feed.downloaded` | info | `feedId`, `url`, `bytes`, `durationMs` (download mode only) |
| `catalog.feed.download_failed` | error | `feedId`, `url`, `reason`, `httpStatus?`, `durationMs`, `error` |
| `catalog.feed.imported` | info | `feedId`, `counts` (object: table → rows), `durationMs` |
| `catalog.build.completed` | info | `catalogVersion`, `outputPath`, `sizeBytes`, `durationMs` |
| `catalog.build.failed` | error | `durationMs`, `error` |

Feeds are still downloaded in parallel; a single download failure still fails the build (Vercel keeps
the previous deployment — unchanged).

`rebuild-catalog-handler.ts`: deps gain `logger: Logger`.

| Event | Level | Fields |
|---|---|---|
| `catalog.rebuild.triggered` | info | `hookStatus` |
| `catalog.rebuild.hook_failed` | error | `hookStatus?`, `error?` — **never** the hook URL |
| `catalog.rebuild.unauthorized` | warn | — |
| `server.misconfigured` | error | `missing` |

### 4.6 Privacy rules (enforced by tests)
- Never log: query strings, coordinates, `bbox`, request headers (except reading `x-vercel-id`),
  `API_KEY`, `CRON_SECRET`, `CATALOG_DEPLOY_HOOK_URL`, response bodies.
- Env var **names** are fine; values are not.

---

## 5. Tasks (stories)

- [ ] **E009-T01 — Logger port and stdout adapter.** core + server.
  - §4.1, §4.2 (port, `NOOP_LOGGER`, `createConsoleLogger`, `parseLogLevel`, `serializeError`,
    `logLevel` in `server-config.ts`, `composition/logger.ts`).
  - Tests: level filtering; stream by level; reserved keys win over fields; `Error` fields serialized
    with stack and one-level cause; unserializable fields do not throw; `parseLogLevel` (valid, missing,
    unknown, mixed case); `parseServerConfig` without `LOG_LEVEL` is still ok.
  - No behavior change yet.

- [ ] **E009-T02 — Requests and errors.** Depends on T01. server.
  - §4.3. Wire `logger` in every `/api/v1/**` route file and handler deps; `fakeLogger()` in
    `src/handlers/test-helpers.ts` that records `{ level, event, fields }`.
  - Tests (`handle-api-request.test.ts`): one `http.request` for 200, 401 (warn), 500 misconfigured
    (error + `server.misconfigured`), 503 (`http.catalog_unavailable`), 500 unhandled (`http.unhandled_error`
    with the error); `requestId` from `x-vercel-id`; a `stops/nearby?lat=…&lon=…` request logs a `path`
    with no query and no field contains `44.` / the API key; `durationMs` from the injected clock.
  - Existing handler tests keep passing with the fake logger.

- [ ] **E009-T03 — Live feed logging.** Depends on T01. gtfs + server composition.
  - §4.4. `FeedDownloadError`; provider `logger`/`nowMs`; remove `log-realtime-lag.ts`; wire in the
    composition root.
  - Tests: `downloadStaticFeed` → `http_status` (with status), `timeout` (abort), `network`;
    provider with a fake fetch: one URL 500 → `realtime.fetch_failed` + `realtime.refresh ok=false`;
    garbage bytes → `reason: "decode"`; both fail with a fresh last-good → `realtime.unavailable
    servedLastGood=true`, with none → `false`; background refresh rejection → `realtime.refresh_failed`;
    snapshots returned are equal to the ones before the change (existing tests unchanged).

- [ ] **E009-T04 — Catalog build and cron.** Depends on T01, T03 (`FeedDownloadError`). server.
  - §4.5. `run-catalog-build.ts` + thin script; cron handler logger.
  - Tests: `runCatalogBuild` with fakes — success emits started, downloaded ×N, imported ×N, completed
    in order; a failed download emits `catalog.feed.download_failed` then `catalog.build.failed` and
    rejects; raw mode emits no `downloaded`. Cron: triggered, hook non-2xx, hook throws, unauthorized,
    misconfigured — and no logged line contains the hook URL or the cron secret.
  - Local check: `pnpm --filter @transit/server catalog:build` prints JSON lines per §4.5.

- [ ] **E009-T05 — Close.** `pnpm verify`; new `docs/engineering/logging.md` (format, levels,
  `LOG_LEVEL`, full event table from §4.3–4.5, privacy rules, how to read logs: Vercel dashboard →
  Logs, or `vercel logs <deployment-url>`; local `pnpm dev`); `server.md` (logger in handler deps,
  `LOG_LEVEL` in "Configuration and environment", `logging.md` link); `architecture.md` (`Logger` in the
  ports list, "Realtime cache" mentions the new events); `workflow.md` "Logging" links `logging.md`;
  `AGENTS.md` engineering-docs table gets a `logging.md` row; epic header and index `Done`; list the
  decisions introduced in the project decisions document.

---

## 6. Verification
- `pnpm verify` (Biome + typecheck + tests) on the Mac.
- Local: `pnpm --filter @transit/server dev`, then `curl` a few endpoints (valid, 401, unknown stop):
  one JSON line each. Point one feed's `vehiclePositionsUrl` at an invalid host locally (do not commit)
  and see `realtime.fetch_failed` + `realtime.refresh ok=false`.
- After deploy: open the app on the phone and watch Vercel → Logs live; confirm `http.request` lines
  and `realtime.refresh` / `realtime.lag` every ~10 s per feed while the app polls.
- Build logs of the deploy show the `catalog.*` lines.

## 7. Risks and stop conditions
- **Volume:** `realtime.refresh` + `realtime.lag` add ~2 lines per feed every ~10 s per warm instance. If
  that makes the Vercel log view unusable, stop and ask (options: move `realtime.refresh` to `debug`,
  merge it with `realtime.lag`). Do not sample or drop lines on your own.
- **Hobby retention:** logs last about 1 hour on Hobby. That is accepted (§3). Do not add a drain or an
  external service.
- **New dependency:** none is needed (no pino/winston). If one seems necessary, stop and ask.
- **Next.js APIs:** this epic uses no Next.js API beyond existing route files. If wiring the logger seems
  to require one, read `node_modules/next/dist/docs/` first and stop and ask.
- **Behavior:** if any existing test changes its expected response or snapshot, the change is wrong — stop.
- Never run `git` commands in the user's folder (project rule).

## 8. Open items before execution
- The user confirms the proposals in §3 (JSON always, `LOG_LEVEL`, request levels, `realtime.refresh`
  at `info`).
