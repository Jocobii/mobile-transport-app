# EPIC-002 — Mobile MVP (Nearby, Stop, Search)

| Field | Value |
|---|---|
| Status | Ready |
| Depends on | EPIC-001 (Done): `/api/v1` deployed at `https://mobile-transport-app.vercel.app`, `@transit/api-client`, `@transit/contracts` |
| Related decisions | Project decisions document: "Flujo propuesto", "EPIC-002 — App móvil", UX principles; wireframes canvas "Wireframes EPIC-002" |
| Read first | `AGENTS.md`, `docs/engineering/mobile.md`, `architecture.md`, `principles.md`, `typescript.md`, `testing.md`, `workflow.md`, `apps/mobile/AGENTS.md` |
| Target | A proof of concept the user can test on an Android phone in the field (MSP Terminal 1, route 436) |

---

## 1. Goal

Replace the Expo template with a first usable app: a map that is always visible plus a bottom panel that shows
nearby stops with their next arrivals, a stop's arrivals, search, and the live buses of a searched route.

### Definition of success

1. On an Android device, opening the app shows the map at the user's location, nearby stops with their next
   arrivals, and the buses approaching the user, with no interaction.
2. Tapping a stop (card or map marker) shows that stop's arrivals, ordered by time, live vs scheduled always visible.
3. Typing `436` in search and tapping the route shows that route's live buses on the map with their destination.
4. Data refreshes every 20 s while the app is in the foreground and stops refreshing in the background.
5. Every user-visible string (including accessibility labels) comes from `src/i18n/locales/es.json`.
6. `VehicleDto.headsign` carries the trip's destination (no longer `""`).
7. `pnpm verify` passes.

---

## 2. Scope

### In scope
- Headsign for vehicles (core model, gtfs normalization, server mapper, tests).
- Mobile: map (`react-native-maps`), location (`expo-location`), i18n (`i18next`, `react-i18next`, `expo-localization`).
- Panels: Nearby, Stop, Search, Route vehicles.
- States: loading, error with retry, empty (no arrivals, no search results), location permission denied (minimal).
- "X min tarde" / "X min antes" for live arrivals (from `delaySec`).
- "Actualizado hace X s" freshness label.
- Canceled trips and skipped stops shown struck through with a red label.
- Removing the Expo template screens and components.

### Out of scope (do not implement)
- Route view (shape, stop list, direction selector) and Vehicle view — EPIC-003.
- Route filter chips in the Stop panel.
- Feed-down banner (arrivals simply fall back to scheduled; the app shows `source` as usual).
- Draggable/snap bottom sheet, animations, dark theme polish.
- Recents, favorites, notifications, service alerts, English locale file.
- App name, icon, splash and `scheme` changes (`app.json` stays "mobile").
- iOS build verification.
- Any new server endpoint or contract field other than filling `VehicleDto.headsign`.

---

## 3. Decisions this epic relies on (concrete values)

| Topic | Value |
|---|---|
| Map library | `react-native-maps` (Google Maps on Android). API key supplied by the human (§14). |
| Location | `expo-location`, foreground permission only. One position on start and on "recenter"; no continuous watch. |
| Location denied / unavailable | Map centered on downtown Minneapolis `44.9778, -93.2650`, zoom showing ~2 km; panel shows a short message and the search bar still works. |
| i18n | `i18next` + `react-i18next` + `expo-localization`; only `es` for now; fallback `es`. |
| Refresh | Every **20 s** for the active panel's query (nearby, stop arrivals, route vehicles); paused when `AppState` is not `active`; immediate refetch on return to `active`. Search does not poll. |
| Nearby query | `getNearbyStops({ lat, lon })` with the server default radius (500 m). Uses the last known user position; the map panning does **not** re-query. |
| Tap on a route in search | Route vehicles mode: `getRouteVehicles(routeId)` (both directions), map fits to the vehicles, panel shows the route header and vehicle count. No route view. |
| Canceled / skipped | Shown, struck through, red status label ("Cancelado" / "No pasará por esta parada"). |
| Freshness label | Seconds since the last **successful** response of the active panel's query, updated every 1 s. |
| Bottom panel | Fixed (not draggable). Nearby/Stop/Route panels: 45 % of screen height. Search panel: from below the search bar to the bottom. |
| Navigation | One screen (`src/app/index.tsx`) with a panel state machine; Android back button walks back the panel stack and exits only from Nearby. The map is never unmounted. |
| API config | `EXPO_PUBLIC_API_URL=https://mobile-transport-app.vercel.app`, `EXPO_PUBLIC_API_KEY=<same API_KEY as server>` in `apps/mobile/.env.local` (git-ignored). Personal-use app: shipping the key in the bundle is accepted. |
| Visual style | Wireframes: neutral light theme, black route badges, monospace numbers. Tokens in §7.6. |

---

## 4. Server change: vehicle headsign

### 4.1 `@transit/core` — `packages/core/src/model.ts`
- Add `headsign: string` to `Vehicle` (required). Empty string only when the catalog trip has no headsign.

### 4.2 `@transit/gtfs` — `normalize-vehicle-positions.ts`
- When building a `Vehicle`, set `headsign: trip.headsign` from the catalog trip already looked up
  (the catalog is authoritative, same as `routeId`/`directionId`).

### 4.3 `apps/server` — `src/mappers/vehicle.ts`
- `headsign: vehicle.headsign`. Update the doc comment (remove the "always empty" note).

### 4.4 Tests
- gtfs: a normalized vehicle carries its catalog trip's headsign (Metro Transit or MVTA fixture).
- server: `mapVehicle` maps `headsign`.
- Fix every fake/test builder of `Vehicle` that now needs `headsign`.

---

## 5. Mobile architecture (follows `docs/engineering/mobile.md`)

```
apps/mobile/src/
├─ app/
│  ├─ _layout.tsx            providers (i18n init, SafeAreaProvider, GestureHandlerRootView), no tabs
│  └─ index.tsx              the single screen: <TransitMap/> + <Panel/> driven by usePanelState
├─ api/
│  └─ client.ts              createApiClient from EXPO_PUBLIC_API_URL / EXPO_PUBLIC_API_KEY (only place reading env)
├─ i18n/
│  ├─ index.ts               i18next init (es only), exports `t` hook usage via react-i18next
│  └─ locales/es.json
├─ shared/
│  ├─ theme.ts               design tokens (§7.6)
│  ├─ format/
│  │  ├─ arrival-time.ts     formatArrivalTime (§7.1) + tests
│  │  ├─ arrival-status.ts   formatArrivalStatus (§7.2) + tests
│  │  ├─ distance.ts         formatDistance (§7.3) + tests
│  │  └─ freshness.ts        secondsSince (§7.4) + tests
│  ├─ polling/
│  │  ├─ use-polled-query.ts hook (§7.5)
│  │  └─ poll-controller.ts  pure scheduler logic used by the hook + tests
│  └─ components/            RouteBadge, LiveIcon, ArrivalRow, FreshnessLabel, PanelState (loading/error/empty), SearchBar
└─ features/
   ├─ map/                   TransitMap, StopMarker, VehicleMarker, useUserLocation
   ├─ nearby/                NearbyPanel, NearbyStopCard, useNearby
   ├─ stop/                  StopPanel, useStopArrivals
   ├─ search/                SearchPanel, useSearch (debounced)
   └─ route/                 RouteVehiclesPanel, useRouteVehicles
```

`usePanelState` (in `src/app/` or `src/shared/`): a stack of panels
`{ kind: "nearby" } | { kind: "stop"; stopId } | { kind: "search" } | { kind: "route"; routeId }`,
with `push`, `back`, `reset`. Pure reducer + tests.

---

## 6. Screens (match the wireframes)

### 6.1 Nearby (initial)
- Map: user dot (native `showsUserLocation`), one marker per nearby stop, one marker per `approachingVehicles`
  item across all stops (dedupe by `vehicle.id`), each a black pill with `routeShortName` and an arrow rotated by
  `bearing` (no arrow when `bearing` is undefined).
- Search bar floating at the top: tapping it pushes `search`.
- Recenter button above the panel: gets a new position, recenters, refetches nearby.
- Panel: title "Cerca de ti", `FreshnessLabel`, `FlatList` of stop cards: stop name, distance, up to 3
  `nextArrivals` rows (badge, headsign, live icon, time). Tapping a card or a stop marker pushes `stop`.
- `outsideRadius: true`: show a one-line note "No hay paradas a menos de 500 m. Mostrando la más cercana."
- Loading (first load only): skeleton cards + "Buscando paradas cerca de ti… La primera carga puede tardar unos segundos."
- Error: message + "Reintentar".

### 6.2 Stop
- Map centers on the stop (keeps the user dot); stop marker highlighted.
- Header: back button (map overlay, top-left), stop name, "Parada {code} · a {distance}" (distance only when the
  user position is known; computed on the device with haversine), `FreshnessLabel`.
- `FlatList` of `arrivals`: big time (§7.1), route badge, headsign, status line (§7.2).
- Empty: "No hay llegadas en los próximos 90 min" + "Puede que el servicio ya haya terminado por hoy."

### 6.3 Search
- Search input focused, back button closes search, clear button.
- Debounce 300 ms; minimum 1 character; trim; max 50 characters (server limit).
- Sections "Rutas" and "Paradas" (`SectionList`). Route row: badge + `longName` + agency label from `feedId`
  (`metrotransit` → "Metro Transit", `mvta` → "MVTA", in `es.json`). Stop row: name + "Parada {code}".
- Tap route → push `route`. Tap stop → push `stop`.
- Initial hint: "Escribe el número de una ruta o el nombre o número de una parada." + example chips `436`, `54`
  (tapping fills the query).
- No results: "No encontramos «{query}»" + "Busca rutas de Metro Transit y MVTA por número, o paradas por nombre o número."

### 6.4 Route vehicles
- Map shows only this route's vehicles (same pill marker), fits to them (padding so the panel does not cover them);
  if there are none, keep the current region.
- Panel: back, route badge + `longName`, "{count} camiones en vivo" (plural via i18n), list of vehicles:
  headsign ("Hacia {headsign}", or "Sin destino" if empty) and "actualizado hace X s" from `updatedAt`.
  Tapping a vehicle row centers the map on it. Empty: "No hay camiones en vivo de esta ruta ahora."

---

## 7. Formatting and behavior rules (implement exactly, all pure and tested)

`now` is always injected (epoch seconds). Times are shown in the device's local time zone.

### 7.1 `formatArrivalTime(arrival, now)` → `{ primary: string; unit: string; struck: boolean }`
- `status !== "normal"` → clock time of `scheduledTime ?? time`, `unit: ""`, `struck: true`.
- `diff = time - now`. `diff < 60` → primary "Ahora", unit "".
- `diff < 3600` → primary `floor(diff / 60)`, unit "min".
- otherwise → clock time `h:mm` (12-hour, no a.m./p.m. suffix in the big time), unit "".
- Nearby rows use `primary + " " + unit` as one string ("4 min"); Stop rows show them stacked.

### 7.2 `formatArrivalStatus(arrival)` → `{ key: string; params?: object; tone: "live" | "scheduled" | "problem" }`
- `canceled` → `arrival.canceled`, tone `problem`. `skipped` → `arrival.skipped`, tone `problem`.
- `source === "scheduled"` → `arrival.scheduled`, tone `scheduled`.
- live, `delaySec` undefined or `|delaySec| < 60` → `arrival.liveOnTime`.
- live, `delaySec >= 60` → `arrival.liveLate` with `{ minutes: round(delaySec / 60) }`.
- live, `delaySec <= -60` → `arrival.liveEarly` with `{ minutes: round(-delaySec / 60) }`.

### 7.3 `formatDistance(meters)` → `< 1000` → `"{round to 10} m"`; else `"{one decimal} km"`.

### 7.4 Freshness
- `secondsSince(timestamp, now)`, never negative. Label: `< 60` → "Actualizado hace {s} s"; else
  "Actualizado hace {m} min".

### 7.5 `usePolledQuery(key, fetcher, { intervalMs: 20000, enabled })`
- Returns `{ data, error, isInitialLoading, lastSuccessAt, refetch }`.
- Runs immediately when `key` changes; keeps showing the previous `data` of the same key while refetching.
- A failed refresh keeps the last `data` and sets `error`; the UI shows the error state only when there is no `data`.
- Pauses when `AppState` ≠ `active`, refetches immediately on return. Ignores responses of a stale `key`.
- Interval from `src/shared/config.ts` (`REFRESH_INTERVAL_MS = 20000`), never hard-coded in components.
- Scheduling logic lives in `poll-controller.ts` (pure, injected clock/timers) and is unit tested.

### 7.6 Theme tokens (`src/shared/theme.ts`)
`ink #1d1d1b`, `inkSecondary #3d3c39`, `muted #5f5e5a`, `line #e0ded7`, `surface #ffffff`, `map #e4e2dc`,
`live #1f7a4d`, `problem #a3281c`, radii `badge 6`, `card 14`, `panel 20`; spacing scale 4/8/12/16/24;
font sizes: body 15, title 20, bigTime 24; monospace for times and badges (platform monospace, no font download).

---

## 8. i18n keys (`src/i18n/locales/es.json`)

Namespaced English keys, Spanish values. Minimum set (add others as needed, never inline Spanish in code):
`search.placeholder`, `search.hint`, `search.noResults`, `search.noResultsHint`, `search.routes`, `search.stops`,
`search.clear`, `search.close`, `nearby.title`, `nearby.loading`, `nearby.outsideRadius`,
`nearby.locationDenied`, `map.recenter`, `stop.code`, `stop.codeWithDistance`, `stop.empty`, `stop.emptyHint`,
`route.vehicleCount` (plural), `route.towards`, `route.noHeadsign`, `route.empty`, `arrival.now`, `arrival.minutes`,
`arrival.scheduled`, `arrival.liveOnTime`, `arrival.liveLate`, `arrival.liveEarly`, `arrival.canceled`,
`arrival.skipped`, `arrival.liveIconLabel`, `freshness.seconds`, `freshness.minutes`, `common.back`,
`common.retry`, `common.error`, `agency.metrotransit`, `agency.mvta`.

Values: "Buscar ruta o parada", "Cerca de ti", "En vivo · a tiempo", "En vivo · {{minutes}} min tarde",
"En vivo · {{minutes}} min antes", "Programado", "Cancelado", "No pasará por esta parada", "Ahora", etc.,
matching §6.

---

## 9. Tasks

Execute in order. Mark each checkbox when done. Commit per task (Conventional Commits, English).

- [ ] **E002-T01 — Vehicle headsign (server).** §4. Tests first. `pnpm verify`.
- [ ] **E002-T02 — Mobile dependencies and config.** Install with `npx expo install react-native-maps expo-location
  expo-localization` and `pnpm --filter @transit/mobile add i18next react-i18next @transit/api-client @transit/contracts`
  (workspace deps as `workspace:*`). Configure `react-native-maps` (Google Maps API key for Android via env
  `GOOGLE_MAPS_ANDROID_API_KEY`, read in `app.config.ts`, never committed) and `expo-location` permission text in
  Spanish, following the SDK 57 versioned docs. Add `apps/mobile/.env.example`. Add Vitest to `apps/mobile`
  (`test` script, pure TS tests only, no React Native renderer). Acceptance: `pnpm verify` passes.
- [ ] **E002-T03 — Remove the template.** Delete template screens/components/hooks (`explore.tsx`, `app-tabs*`,
  `animated-icon*`, `hint-row`, `web-badge`, `collapsible`, `external-link`, `themed-*`, template `constants/theme.ts`,
  template color-scheme hooks) and unused template assets. `_layout.tsx` becomes a plain stack with no header.
- [ ] **E002-T04 — Foundations.** `src/api/client.ts`, `src/i18n/`, `src/shared/theme.ts`, `src/shared/config.ts`,
  formatters (§7.1–7.4) with tests, `poll-controller` + `usePolledQuery` (§7.5) with tests, panel state reducer with tests.
- [ ] **E002-T05 — Map and location.** `TransitMap`, markers, `useUserLocation` (permission, denied fallback §3),
  recenter button.
- [ ] **E002-T06 — Nearby panel.** §6.1 including loading, error, `outsideRadius`, approaching vehicle markers.
- [ ] **E002-T07 — Stop panel.** §6.2 including canceled/skipped and empty state.
- [ ] **E002-T08 — Search panel.** §6.3.
- [ ] **E002-T09 — Route vehicles panel.** §6.4.
- [ ] **E002-T10 — Back behavior and polish.** Android back per §3, accessibility labels on icon buttons,
  touch targets ≥ 44 dp, no Spanish outside `es.json`.
- [ ] **E002-T11 — Closing.** `pnpm verify`; update `docs/engineering/mobile.md` if the structure changed;
  set this epic and the index to `Done`; list decisions introduced during implementation for the decisions document.

---

## 10. Verification

1. `pnpm verify` (Biome + typecheck + tests).
2. `npx expo-doctor` in `apps/mobile`.
3. `npx expo run:android` on a device (human). Check, with real data:
   - Nearby loads at the current location; approaching buses show on the map.
   - Stop arrivals show live (green) vs scheduled, "X min tarde" when delayed.
   - Search `436` → route → live buses with "Hacia Eagan Transit Station" (or the current headsign).
   - Freshness label resets about every 20 s; background → foreground triggers a refresh.
   - Airplane mode: last data stays; with no data, the error state and "Reintentar" appear.
   - Deny location: map on downtown Minneapolis, search still works.

---

## 11. Risks and stop conditions

- **Android toolchain not yet verified** (`adb devices`, `expo run:android`). If the build fails for environment
  reasons, stop and report; do not change project structure to work around it.
- `react-native-maps` configuration differs between SDK versions: follow the SDK 57 versioned docs; if they
  contradict this epic, stop and ask.
- Any need for a new endpoint, contract field (besides headsign) or business rule in the app: stop and ask.
- If a formatting rule in §7 produces something that contradicts the wireframes, §7 wins; note it for the user.

## 12. Manual steps for the human (the agent must not attempt these)

1. Google Cloud: create a project (or reuse one), enable **Maps SDK for Android**, create an API key restricted to
   Android apps (package name from `app.json`/`app.config.ts`, SHA-1 of the debug keystore). Put it in
   `apps/mobile/.env.local` as `GOOGLE_MAPS_ANDROID_API_KEY`.
2. `apps/mobile/.env.local`: `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_API_KEY`.
3. Connect the phone (USB debugging) and run `npx expo run:android`.
