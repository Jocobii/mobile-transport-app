# apps/server (Next.js on Vercel)

The server is **transport and composition only**. Domain logic lives in `@transit/core`;
data source logic lives in adapters (`@transit/gtfs`).

## Framework version

Next.js in this repo may differ from what you remember. Read the versioned docs shipped in
`node_modules/next/dist/docs/` (see `apps/server/AGENTS.md`) before using any Next.js API.

## Structure

```
apps/server/
├─ app/api/v1/<resource>/route.ts   route handlers (thin)
├─ src/composition/                 composition root: builds TransitService with real adapters
├─ src/config/                      agency registry, env parsing, constants (TTL, thresholds)
├─ src/http/                        auth, error mapping, cache headers, request validation
└─ src/mappers/                     domain → @transit/contracts mappers
```

## Route handler rules

A route handler does exactly these steps, and nothing else:

1. Authenticate (`x-api-key`, shared helper).
2. Parse and validate input (query/path params) into typed values.
3. Call **one** `TransitService` use case.
4. Map the result to a `@transit/contracts` shape.
5. Respond with the right status and `Cache-Control` headers.

- No feed fetching, parsing, merging or sorting inside route handlers.
- Errors are converted to `ApiErrorBody` in one shared place. Unknown errors → `500` with a generic code,
  logged once.
- Invalid input → `400` with a specific code. Unknown resource → `404`.

## Composition root

- The only place where concrete adapters, clock and cache are instantiated and wired.
- Agencies come from the `AgencyRegistry` configuration. **Never** branch on agency or route ids in code.
- In-memory caches are created here and injected; no module-level mutable singletons elsewhere.

## Configuration and environment

- Environment variables are parsed and validated once at startup into a typed config object.
- Required: `API_KEY`. Missing or invalid config fails fast with a clear message.
- Feed URLs, TTLs, stale thresholds and source priorities live in configuration, not in logic.

## Vercel constraints

- Serverless: no background polling, no long-lived timers.
- Realtime feeds: fetched on demand, cached with a short TTL; responses set a short `s-maxage`.
- One agency failing must not fail the request: use `Promise.allSettled` and fall back to schedule.
- Keep responses small (well under the 4.5 MB limit); return only what the screen needs.

## Out of scope for this app

- UI pages beyond an optional diagnostics page (not decided yet).
- Styling frameworks, image optimization, auth providers, databases — unless a decision adds them.
