# EPIC-005 — Map coverage and layers (wider range, viewport layers, layer toggles, free bus exploration)

| Field | Value |
|---|---|
| Status | Done |
| Depends on | EPIC-003 Done. **Independent of EPIC-004** (Route view); can run before it. |
| Related decisions | Project decisions document: "EPIC-005 — Cobertura del mapa y capas" (2026-09-19) |
| Read first | `AGENTS.md`, `docs/engineering/architecture.md`, `principles.md` (Performance section), `mobile.md`, `server.md`, `typescript.md`, `testing.md`, `apps/mobile/AGENTS.md`, SDK 57 versioned docs, `react-native-maps` Marker docs |

---

## 1. Goal

Today the initial state shows stops within 500 m (max 10) and only the buses approaching those stops.
In low-density areas (e.g. Eagan) that is "1 route · 2 stops", and the map looks empty.
This epic widens what the user sees **without slowing the device**, and lets the user hide live buses and stops.
It also removes a second limitation: once a Nearby row is tapped, its stop stays highlighted forever and the Vehicle
view only works "relative to my stop". The user must be able to **clear "my stop"** and open **any bus**, and a
selected bus shows **its stops** on the map.

### Key architectural idea

Split two things that are coupled today:

| | Nearby list (panel) | Map layers |
|---|---|---|
| Question it answers | "What can I catch here?" | "What is around this area?" |
| Data | Heavy: arrivals per stop, merge live + scheduled | Light: positions only |
| Driven by | User position (adaptive radius) | **Visible map area (viewport)** |
| Endpoint | `stops/nearby` (existing) | `stops/in-area`, `vehicles/in-area` (new) |

Growing the Nearby radius a lot would multiply per-stop arrival work on the server and the size of the response.
Instead, the list grows only a little (adaptive radius) and the **map** gets coverage from cheap, viewport-driven
layers with zoom gates and hard caps.

### Definition of success

1. In a low-density area the Nearby list shows at least 3 stops when they exist within 1.5 km.
2. Panning/zooming the map shows **all stops** and **all live buses** in the visible area (within zoom gates and caps).
3. The map stays smooth on the test phone (Android) with the capped number of markers; no request fires while dragging.
4. A "Layers" control hides/shows live buses and stops; the choice survives an app restart.
5. "My stop" can be cleared (chip with ✕ and Android back); nothing stays highlighted after that.
6. Any bus on the map (Nearby, Search, Route panel) opens the Vehicle view, with or without "my stop".
7. In the Vehicle view the bus's upcoming stops are drawn on the map.
8. Each task (story) below can be merged and tested on the phone on its own, in order.
9. `pnpm verify` passes.

---

## 2. Scope

### In scope
- Server: adaptive Nearby radius; `GET /api/v1/stops/in-area`; `GET /api/v1/vehicles/in-area`.
- Mobile: layer toggles (+ persistence), faster stop markers, viewport-driven stop and bus layers with zoom gates,
  clearing "my stop", Vehicle view without a stop, the selected bus's upcoming stops on the map.

### Out of scope (do not implement)
- Marker clustering or any clustering library.
- Setting "my stop" from the Vehicle view timeline or from the map (only a Nearby row sets it, as today).
- Showing the stops a bus has **already passed** (the API returns upcoming stops only).
- Changing Stop, Route, Vehicle or Trip panel map content (layers and toggles apply only to Nearby and Search).
- Favorites, alerts, English locale, the full Route view (EPIC-004).
- Any endpoint or field not listed in §4.

---

## 3. Decisions this epic relies on

| Topic | Value |
|---|---|
| Buses on the map | **All live buses in the visible area** (not only the approaching ones), same marker style. Tapping rules: see "Opening a bus". |
| Nearby list radius | **Adaptive** when the client omits `radius`: try 500 m, then 1000 m, then 1500 m; stop at the first step that returns **≥ 3 stops**. If the last step has 1–2 stops, return them. If it has 0, the existing 5 km nearest-stop fallback applies. Max stops stays 10. An explicit `radius` disables adaptation (unchanged behavior). |
| Stops layer zoom gate | Visible only when the map `latitudeDelta ≤ 0.03` (≈ 3.3 km tall). Otherwise only Nearby stops are drawn (today's behavior) and a hint chip is shown. |
| Buses layer zoom gate | Visible only when `latitudeDelta ≤ 0.15` (≈ 16 km tall). Otherwise only approaching buses are drawn (today's behavior). |
| Area limits (server) | Stops: bbox span ≤ 0.06° per axis, ≤ 250 results. Buses: bbox span ≤ 0.3° per axis, ≤ 150 results. Results ordered by distance to the bbox center; `truncated: true` when the limit cut results. |
| Fetch area (client) | Visible region expanded by 25 % per side, then snapped **outward** to a 0.005° grid. A new request is made only when the visible region is no longer fully inside the last fetched area, or a zoom gate flips. Region changes are debounced 400 ms after `onRegionChangeComplete` (never during drag). |
| Refresh | Stops layer: not polled (catalog data), in-memory cache of the last fetched area only. Buses layer: polled every 20 s with the existing polling (paused in background). |
| Map content in Nearby/Search | Stops = area stops ∪ nearby stops (dedupe by id). Buses = approaching ∪ area (dedupe by id; approaching entry wins). |
| Tapping | Any stop marker opens the Stop panel (existing). Buses: see "Opening a bus" (until T08 is merged, only approaching buses open the Vehicle view). |
| "My stop" | The stop highlighted after tapping a Nearby row (today's `highlightedStopId`). On app start there is none. While set, a chip under the search bar (Nearby panel only) shows "Tu parada: {name}" with a ✕ button (≥ 44 dp). ✕ clears it. Android back in Nearby with "my stop" set clears it instead of leaving the app. Clearing only removes the highlight; it does not move the map or refetch. |
| Opening a bus | Stop context for the Vehicle view, in this order: 1) "my stop" if the bus approaches it; 2) otherwise **no stop** (post-epic change 2026-09-19: the nearest-stop fallback was removed; a stop is never picked automatically). Applies to bus markers in Nearby, Search and the Route panel. Opening a bus never sets "my stop". |
| Vehicle view without a stop | Same panel and follow mode. No "Llega a tu parada…" line and no "faltan N paradas". Timeline: the next 10 upcoming stops. Map segment: route shape from the bus to its last upcoming stop (straight-line fallback through upcoming stops, as today). First fit: the bus only (`focusOn`). |
| Bus stops on the map | In the Vehicle view, draw every stop in `upcomingStops` with the normal stop marker; the vehicle-view stop (if any) is the selected one. Tapping a stop opens the Stop panel. Layer toggles do not apply (they only affect Nearby/Search). No API change. |
| Layer toggles | Round "Layers" button on the right, above the recenter button, visible only in the Nearby panel. Tapping it opens a small card with two switches: **Camiones en vivo** and **Paradas**. Both on by default. |
| Toggle effects | Apply to the map in Nearby and Search only. The Nearby list is not affected. The highlighted boarding stop stays visible when stops are hidden. A hidden layer makes **no requests** (its query is disabled). |
| Toggle persistence | Saved on the device with `@react-native-async-storage/async-storage` under key `map.layers.v1` as `{ "showVehicles": boolean, "showStops": boolean }`. Defaults are used until loaded and on any read/parse error. |
| Stop marker rendering | Normal stops use the `Marker` `image` prop with a PNG (native bitmap, no React view snapshot). The selected stop keeps the current custom view and label. |
| Cache headers | `stops/in-area`: `private, max-age=300` (catalog). `vehicles/in-area`: `no-store` (realtime). |
| bbox format | Query `bbox=minLon,minLat,maxLon,maxLat` (GeoJSON order), decimal degrees. |

### Performance budgets (acceptance, measured on the test phone)

| Budget | Value |
|---|---|
| Stop markers rendered | ≤ 250 (server cap) + nearby + selected |
| Bus markers rendered | ≤ 150 (server cap) + approaching |
| Requests while dragging | 0 |
| Stops requests | ≤ 1 per "left the fetched area" event |
| Bus requests | 1 per 20 s while the layer is visible and the app is in foreground |
| Server work for area endpoints | O(n) over stops in box / vehicles in cache; no per-stop arrival computation |

---

## 4. Contract and server changes

### 4.1 `@transit/contracts` (additive, v1)

```ts
/** GET /api/v1/stops/in-area?bbox=minLon,minLat,maxLon,maxLat */
export interface StopsInAreaResponse {
  stops: StopSummaryDto[];
  /** true when more stops matched than the server limit. */
  truncated: boolean;
}

/** GET /api/v1/vehicles/in-area?bbox=minLon,minLat,maxLon,maxLat */
export interface VehiclesInAreaResponse {
  vehicles: VehicleDto[];
  truncated: boolean;
  feeds: FeedStatusDto[];
}
```

Invalid `bbox` (not 4 finite numbers, min ≥ max, lat outside [-90, 90], lon outside [-180, 180], span above the
limit) → 400 with the existing `invalid_request` code. No new error code.

### 4.2 `@transit/core`
- Model: `Bounds { minLat; minLon; maxLat; maxLon }` (degrees).
- Settings (`settings.ts` + `apps/server/src/config/transit-settings.ts`):
  - `nearbyRadiusStepsMeters: number[]` = `[500, 1000, 1500]` (replaces `nearbyDefaultRadiusMeters`; the first step is the default).
  - `nearbyMinStops: 3`.
  - `areaStopsMaxSpanDegrees: 0.06`, `areaStopsMaxResults: 250`.
  - `areaVehiclesMaxSpanDegrees: 0.3`, `areaVehiclesMaxResults: 150`.
- Port `CatalogProvider`: add `findStopsInBounds(bounds: Bounds, limit: number): Promise<{ stops: Stop[]; truncated: boolean }>`
  ordered by distance to the bounds center.
- `TransitService`:
  - `getNearby(center, radiusMeters?: number)`: when `radiusMeters` is undefined, iterate `nearbyRadiusStepsMeters`
    as in §3; arrivals are computed **only** for the final set of stops.
  - `getStopsInArea(bounds)` → `{ stops, truncated }`.
  - `getVehiclesInArea(bounds)` → `{ vehicles: { vehicle: Vehicle; route: Route }[]; truncated; feeds }`:
    filter `fetchRealtime().vehicles` by bounds (O(V)), sort by distance to center, cut to the limit,
    resolve each distinct `routeId` once (a `Map` per call); drop vehicles whose route is not in the catalog.
- Pure helpers in `domain/bounds.ts`: `boundsContain`, `boundsCenter`, `boundsSpan`. Tests.

### 4.3 `@transit/gtfs`
- `SqliteCatalogProvider.findStopsInBounds`: reuse the indexed `stmtStopsInBox` (index `stops_lat_lon`), compute
  distance to center, sort, `truncated = rows.length > limit`, slice. Tests with fixture stops.

### 4.4 `apps/server`
- `src/http/parse-bbox.ts` (pure, tested): parse + validate `bbox` against a max span.
- Handlers as factories (same pattern as existing): `stops-in-area-handler.ts`, `vehicles-in-area-handler.ts`;
  routes `app/api/v1/stops/in-area/route.ts` and `app/api/v1/vehicles/in-area/route.ts`. `x-api-key` required.
- Vehicles mapped with the existing `mapVehicle(vehicle, route)`; stops with the existing stop summary mapper.
- `stops-nearby-handler`: pass `undefined` to `getNearby` when `radius` is omitted.

### 4.5 `@transit/api-client`
- `getStopsInArea(bounds: { minLat; minLon; maxLat; maxLon })` and `getVehiclesInArea(bounds)`; the client builds the
  `bbox` string (6 decimals). Tests for the URL.

---

## 5. Mobile design

### 5.1 New and changed files

```
src/features/map/
  viewport.ts              pure: regionToBounds, expandBounds, snapBoundsOutward, containsBounds, isWithinZoomGate
  select-map-content.ts    pure: moved out of app/index.tsx; takes panel kind, nearby data, area data, layers
  map-layers.ts            pure: MapLayers type, DEFAULT_MAP_LAYERS, parseStoredLayers
  use-map-layers.ts        state (T01) + persistence (T06)
  use-area-stops.ts        one-shot fetch per fetched area (pattern of use-route-shape.ts)
  use-area-vehicles.ts     usePolledQuery keyed by the fetched area
  LayersButton.tsx         round button, 48 dp, layers icon (react-native-svg)
  LayersCard.tsx           card with two Switch rows
  ZoomHint.tsx             chip "Acerca el mapa para ver todas las paradas"
  MyStopChip.tsx           chip "Tu parada: {name}" + ✕ (T07)
src/features/vehicle/
  resolve-vehicle-stop.ts  pure: the "Opening a bus" rule (T08)
src/shared/panel/panel-state.ts   vehicle panel `stopId?: string | undefined` (T08)
  TransitMap.tsx           + onRegionChangeComplete prop; memoized markers
  StopMarker.tsx           image-based normal stop; React.memo
  VehicleMarker.tsx        React.memo
assets/map/stop-dot.png (+ @2x, @3x)
```

### 5.2 i18n additions (`es.json`)

```json
"map": {
  "layers": {
    "button": "Capas del mapa",
    "title": "Mostrar en el mapa",
    "vehicles": "Camiones en vivo",
    "stops": "Paradas"
  },
  "zoomInForStops": "Acerca el mapa para ver todas las paradas",
  "myStop": "Tu parada: {{name}}",
  "clearMyStop": "Quitar tu parada"
}
```
Vehicle view without a stop reuses existing `vehicle.*` keys; add a key only if a new visible text is needed
(e.g. a "Próximas paradas" title if none exists).
(merge into the existing `map` object; keep existing keys.)

---

## 6. Tasks (stories)

Each task is a vertical slice: after it is merged, the app is testable on the phone and delivers value on its own.
Hard dependencies are listed; everything else is independent.

- [x] **E005-T01 — Layer toggles (session).** *As a rider, I want to hide live buses or stops on the map, so I can
  read the map without clutter.* Depends on: none. Client only.
  - Move `selectMapContent` from `app/index.tsx` to `features/map/select-map-content.ts`; add a `layers: MapLayers`
    argument. In `nearby`/`search`: `showVehicles=false` → no buses; `showStops=false` → only the highlighted
    boarding stop (if any). Other panels ignore `layers`.
  - `map-layers.ts`, `use-map-layers.ts` (in-memory state), `LayersButton`, `LayersCard` (closes on outside tap
    and on Android back), i18n keys. Button hidden outside the Nearby panel.
  - Tests: `select-map-content` (each panel × each layer combination; highlighted stop kept), `map-layers`.
  - Phone check: toggle each switch; markers disappear/appear instantly; the list is unchanged.

- [x] **E005-T02 — Faster stop markers.** *As a rider, I want the map to stay smooth, so more stops can be shown.*
  Depends on: none. Client only. Must be done before T04.
  - Create `assets/map/stop-dot.png` at 1×/2×/3× (14/28/42 px circle, white fill, `#6D6C67` border 2.5/5/7.5 px,
    transparent background). Commit the PNGs only.
  - `StopMarker`: non-selected stops use `<Marker image={...} anchor={{x:0.5,y:0.5}} tracksViewChanges={false}>`
    with no children; selected stop keeps the custom view + label. Wrap `StopMarker` and `VehicleMarker` in
    `React.memo`; make `onStopPress`/`onVehiclePress` stable (`useCallback` in the screen).
  - Tests: existing tests pass; add a test for `vehicleMarkerKey` stability if not present.
  - Phone check: same look as before; opening Nearby and panning feel at least as smooth.

- [x] **E005-T03 — Adaptive Nearby radius.** (server code done; deploy to Vercel still pending) *As a rider in a suburb, I want the list to reach a bit further, so I
  see more than one or two stops.* Depends on: none. Server only (+ deploy to Vercel).
  - Settings, `getNearby(center, radius?)` per §3/§4.2, handler change per §4.4.
  - Tests (core): ≥ 3 at 500 m → stops at 500; 2 at 500 and 4 at 1000 → 1000; 1 at 1500 → returns 1;
    0 at 1500 → 5 km fallback with `outsideRadius`; explicit radius → no adaptation; arrivals computed only for
    the final set (spy on the fake catalog).
  - Phone check (after deploy, at the Eagan test location): the subtitle shows more stops/routes than "2 paradas".

- [x] **E005-T04 — Stops layer from the visible area.** (server + client code done; deploy to Vercel still
  pending) *As a rider, I want to see every stop in the area I am
  looking at, and tap any of them.* Depends on: T02. Server + client.
  - Core/gtfs/server/api-client for `stops/in-area` (§4). Deploy to Vercel before the app build.
  - `viewport.ts` (§3 fetch-area rule), `TransitMap.onRegionChangeComplete`, debounced region (existing
    `use-debounced-value`, 400 ms), `use-area-stops.ts`, merge in `select-map-content` (respects `showStops` if T01
    is merged), `ZoomHint` when the stops layer is on and the zoom gate hides it.
  - Tests: `parse-bbox` (valid, reversed, NaN, out of range, too large), `findStopsInBounds` (order, limit,
    truncated), `getStopsInArea`, handler (200, 400, 401, cache header), `viewport.ts` (expand, snap outward,
    contains, zoom gate boundaries 0.03 / 0.15), `select-map-content` merge + dedupe.
  - Phone check: pan around Eagan and downtown; stops appear after the map settles, never while dragging;
    zooming out past the gate leaves only nearby stops and shows the hint; tapping any stop opens the Stop panel.

- [x] **E005-T05 — Live buses layer from the visible area.** (server + client code done; deploy to Vercel
  still pending) *As a rider, I want to see every live bus in the area,
  not only the ones coming to my stop.* Depends on: none (uses `viewport.ts` from T04 if present; otherwise create
  it here with the same spec). Server + client.
  - Core/server/api-client for `vehicles/in-area` (§4). Deploy to Vercel before the app build.
  - `use-area-vehicles.ts` polled every 20 s, enabled only in Nearby/Search, inside the zoom gate and (if T01 is
    merged) with `showVehicles`. Merge with approaching buses (approaching wins). Non-approaching buses: no
    `onPress` action.
  - Tests: `getVehiclesInArea` (bounds filter, order, limit, truncated, unknown route dropped, one route lookup per
    distinct route), handler (200, 400, `no-store`), merge/dedupe in `select-map-content`.
  - Phone check: buses of other routes appear and move every ~20 s; tapping an approaching bus still opens the
    Vehicle view; tapping another bus does nothing; backgrounding the app stops requests.

- [x] **E005-T06 — Remember layer toggles.** *As a rider, I want my layer choice to stay after I close the app.*
  Depends on: T01. Client only. New dependency (reason: device key-value storage; not present in the app).
  - `npx expo install @react-native-async-storage/async-storage` (run on the Mac). Stop and ask if it does not
    install cleanly for SDK 57.
  - `use-map-layers.ts`: load once on mount, save on change; `parseStoredLayers` returns defaults for missing,
    malformed or partial data. Wrap every storage call in try/catch.
  - Tests: `parseStoredLayers` (valid, invalid JSON, wrong types, null).
  - Phone check: hide buses, kill the app, reopen → buses still hidden.

- [x] **E005-T07 — Clear "my stop".** *As a rider, I want to un-select my stop, so the app is not tied to it and I
  can look at other buses.* Depends on: none. Client only.
  - `MyStopChip` under the search bar in Nearby while `highlightedStopId` is set (name from the Nearby data; hide the
    chip if the stop is no longer in the data). ✕ → `setHighlightedStopId(undefined)`.
  - Android back handler: in Nearby with a highlighted stop → clear and consume the event; otherwise current behavior.
  - Extract the back decision as a pure function (`nearby | other panel` × `stop set | not set`) with tests.
  - Phone check: open the app (no chip), tap a row → chip appears and the stop is highlighted; ✕ → chip and
    highlight gone; set it again and press back → cleared, a second back leaves the app.

- [x] **E005-T08 — Open any bus (Vehicle view without a stop).** *As a rider, I want to tap any bus and see where it
  goes, even if it is not coming to my stop.* Depends on: none (works with approaching and Route-panel buses; with T05
  it also covers area buses). Client only.
  - `Panel` vehicle `stopId?: string | undefined`; update the reducer tests.
  - `resolve-vehicle-stop.ts` implements "Opening a bus" (§3). Tests: approaches my stop; approaches another nearby
    stop only; approaches none; no Nearby data.
  - Every bus marker gets `onPress` in Nearby, Search and Route panels, using that rule.
  - `useVehicleView`, `VehiclePanel`, `stopsUntil` callers and `segmentToStop` handle a missing stop as in §3
    ("Vehicle view without a stop"). Tests for the no-stop branches of the pure functions.
  - Phone check: clear "my stop", tap a bus of another route → Vehicle view with next stops, no "tu parada" line;
    tap a bus approaching my stop → the usual view with "Llega a tu parada…"; from Search → route → tap a bus works.

- [x] **E005-T09 — Bus stops on the map.** *As a rider, when I select a bus I want to see its stops on the map.*
  Depends on: none (best after T02 for marker cost). Client only. **Last feature task.**
  - `useVehicleView` map content: stops = `upcomingStops` (deduped by id) instead of only the target stop; the
    vehicle-view stop stays selected. Tapping a stop opens the Stop panel.
  - Tests: the pure map-content builder (with stop, without stop, empty upcoming list, duplicates).
  - Phone check: open a bus → its remaining stops appear along the route segment; tapping one opens its arrivals.

- [x] **E005-T10 — Closing.** `pnpm verify`; update `docs/engineering/mobile.md` (map layers, viewport rules,
  marker rendering) and `architecture.md` (new use cases and port method); set epic and index to `Done`; list the
  decisions introduced for the decisions document.

---

## 7. Verification

1. `pnpm verify`.
2. After deploying the server:
   - `curl -H "x-api-key: …" "$API/api/v1/stops/in-area?bbox=-93.28,44.97,-93.25,44.99"` → ≤ 250 stops, `truncated` present.
   - `curl … "$API/api/v1/vehicles/in-area?bbox=-93.40,44.85,-93.10,45.05"` → ≤ 150 vehicles with colors.
   - A bbox wider than the limit → 400 `invalid_request`.
3. `npx expo run:android` on the phone (human): the checks listed in each task, plus downtown Minneapolis at
   street zoom (worst case: caps reached) — panning stays smooth and the JS thread does not freeze.
4. Free exploration flow: open the app → tap a row → clear "my stop" → pan → tap an unrelated bus → its stops show
   on the map → tap one of them → its arrivals → back twice returns to Nearby with no stop highlighted.

---

## 8. Risks and stop conditions

- Map still stutters on the phone at the caps: report the numbers (marker counts, zoom) and stop. Do not add a
  clustering library or change caps without asking.
- `Marker image` renders at the wrong size or blurry on Android: keep the custom view for stops, report it, continue.
- AsyncStorage incompatible with SDK 57: stop and ask (alternatives need a decision).
- Any need for agency- or route-specific logic, or a new endpoint/field beyond §4: stop and ask.
- The server must be deployed before the app build that calls the new endpoints; the app must tolerate a 404 from
  them (layer shows nothing extra, no error UI).
- Vercel Hobby usage: bus polling adds ~180 invocations per hour of app use; acceptable (1M/month included).
