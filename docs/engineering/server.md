# apps/server (Next.js on Vercel)

The server is **transport and composition only**. Domain logic lives in `@transit/core`;
data source logic lives in adapters (`@transit/gtfs`).

## Framework version

Next.js in this repo may differ from what you remember. Read the versioned docs shipped in
`node_modules/next/dist/docs/` (see `apps/server/AGENTS.md`) before using any Next.js API.

## Structure

```
apps/server/
├─ app/api/v1/<resource>/route.ts       route handlers (thin), production wiring only
├─ app/api/cron/rebuild-catalog/route.ts cron entry point (bearer CRON_SECRET, no x-api-key)
├─ scripts/build-catalog.ts             builds generated/catalog.sqlite (download, or --source=raw)
├─ generated/catalog.sqlite             build output, git-ignored, traced into the deploy bundle
├─ src/composition/                     composition root: builds TransitService with real adapters
├─ src/config/                          feeds (FEEDS), settings (TRANSIT_SETTINGS), env parsing
├─ src/infrastructure/                  SystemClock, InMemoryCache (the only module-level state)
├─ src/http/                            auth (x-api-key + cron bearer token), error mapping,
│                                       cache headers, request/query parsing, handleApiRequest
├─ src/handlers/                        one factory per endpoint: createXHandler(deps) → (req, ctx) => Response
└─ src/mappers/                         domain → @transit/contracts mappers, one file per DTO family
```

`tsconfig.json` defines a `@/*` → `./src/*` path alias; every import within `apps/server/src/**` and
every `app/api/**/route.ts` file uses it (`@/config/...`, `@/handlers/...`, ...), never deep relative
paths like `../../../../src/...`.

## Route handler rules

Each `src/handlers/<name>-handler.ts` exports a factory,
`createXHandler(deps: { getService: () => TransitService; readConfig: () => ServerConfigResult })`
returning `(request, context?) => Promise<Response>`. The route file only wires production
dependencies (`getTransitService`, `readServerConfig`) and exports `runtime = "nodejs"`. Tests call the
factory with a service built from hand-written fakes (`src/handlers/test-helpers.ts`) — no `vi.mock`.

The shared `handleApiRequest` wrapper (`src/http/handle-api-request.ts`) does exactly these steps for
every `/api/v1/**` handler:

1. Read and validate server config; missing `API_KEY` → `500 server_misconfigured`.
2. Authenticate (`x-api-key`, constant-time comparison in `src/http/auth.ts`).
3. Run the handler's own logic (parse params, call **one** `TransitService` use case, map to a
   `@transit/contracts` shape).
4. Catch `CatalogUnavailableError` → `503 catalog_unavailable`; any other thrown error → `500
   internal_error`, logged once (no coordinates or API key in the log).

- No feed fetching, parsing, merging or sorting inside route handlers.
- Invalid input → `400` with a specific code (e.g. `InvalidDirectionError` from `getRouteDetail` is
  caught by that handler itself, not by the generic wrapper, and mapped to `400 invalid_request`).
  Unknown resource → `404`.
- `GET /api/cron/rebuild-catalog` does **not** use `handleApiRequest` — it authenticates with a bearer
  `CRON_SECRET` instead of `x-api-key`, and has its own status mapping (`500` misconfigured, `401`
  bad/missing token, `200 { triggered: true }`, `502` if the deploy hook call fails). See
  `src/handlers/rebuild-catalog-handler.ts`.

## Composition root

- The only place where concrete adapters, clock and cache are instantiated and wired.
- Agencies come from the `AgencyRegistry` configuration. **Never** branch on agency or route ids in code.
- In-memory caches are created here and injected; no module-level mutable singletons elsewhere.

## Configuration and environment

- Environment variables are parsed once, per-request, into a typed `ServerConfigResult`
  (`src/config/server-config.ts`) — not cached at module load, so a fixed env is picked up without a
  redeploy in local dev.
- Required: `API_KEY`. Required in production only: `CRON_SECRET`, `CATALOG_DEPLOY_HOOK_URL` (both
  needed by the cron route; either missing there → `500 server_misconfigured`). Optional: `CATALOG_PATH`.
- Feed identity and URLs live in `src/config/feeds.ts` (`FEEDS: FeedConfig[]`); every tunable numeric
  setting (TTLs, stale thresholds, radii, limits — EPIC-001 §6.2) lives in
  `src/config/transit-settings.ts` (`TRANSIT_SETTINGS`), never inline in logic.

## Vercel constraints

- Serverless: no background polling, no long-lived timers.
- Realtime feeds: fetched on demand, cached with a short TTL; responses set a short `s-maxage`.
- One agency failing must not fail the request: use `Promise.allSettled` and fall back to schedule.
- Keep responses small (well under the 4.5 MB limit); return only what the screen needs.

## Out of scope for this app

- UI pages beyond an optional diagnostics page (not decided yet).
- Styling frameworks, image optimization, auth providers, databases — unless a decision adds them.
