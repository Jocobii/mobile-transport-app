# transit-app

Personal real-time public transit app for the Twin Cities (Minnesota): nearby stops,
arrivals and live bus positions, using official GTFS and GTFS-Realtime feeds.

## Structure

| Path | Description |
|---|---|
| `apps/server` | Next.js API (route handlers only), deployed to Vercel |
| `apps/mobile` | Expo app (Android first, iOS buildable locally) |
| `packages/core` | Canonical model, provider ports, TransitService, Merger |
| `packages/gtfs` | GTFS static and GTFS-Realtime adapters, catalog builder (Node only) |
| `packages/contracts` | Public API request/response shapes |
| `packages/api-client` | Typed API client used by the mobile app |
| `packages/config` | Shared TypeScript configuration |

See `AGENTS.md` for conventions.

## Requirements

- Node.js 24 LTS (`.node-version`)
- pnpm
- Android Studio + JDK 17 for Android builds; Xcode for iOS builds

## Scripts

```bash
pnpm install
pnpm dev        # run all apps in dev mode
pnpm typecheck
pnpm test
pnpm lint       # Biome
pnpm format
pnpm verify     # lint + typecheck + tests (run before every commit)
```
