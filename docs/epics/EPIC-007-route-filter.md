# EPIC-007 — Route filter ("only my buses")

| Field | Value |
|---|---|
| Status | Ready |
| Depends on | EPIC-005 Done. Independent of EPIC-004 (Route view). |
| Related decisions | Project doc `claude/filtro-de-rutas.md` (2026-09-19). This epic **changes scope**: the decisions document lists "planning trips / transfers" as out of scope; a route filter plans nothing, but the user must confirm this scope note before execution (see §8). |
| Read first | `AGENTS.md`, `docs/engineering/architecture.md`, `principles.md`, `mobile.md`, `server.md`, `typescript.md`, `testing.md`, `apps/mobile/AGENTS.md`, EPIC-005 (same files are touched) |

---

## 1. Goal

The user plans trips in Google Maps (e.g. 68 › 345 › 436) and wants the app to show **only those routes**.
Google Maps cannot export a trip, so the user **types the routes once**; the app then hides everything else.

Naming: this is a generic **route filter**, not a "trip". No trip concept, no legs, no order.

### Definition of success
1. The user can pick up to 8 routes by searching by number and tapping (e.g. 68, 345, 436) and can remove them.
2. With the filter on, the map shows only live buses and stops of those routes, and Nearby lists only those routes.
3. In a low-density area the Nearby list still finds the filtered routes' stops (the server filters **before** the adaptive radius, not after).
4. With the filter on, all live buses of the chosen routes are visible even when far from the current view.
5. The filter survives an app restart. No new element appears on the main screen except a small dot on the Layers button.
6. Search, Stop, Route and Vehicle panels are unchanged (search stays global).
7. Each task below can be merged and tested on the phone in order. `pnpm verify` passes.

---

## 2. Scope

### In scope
- Server: optional `routeIds` on `stops/nearby` and `stops/in-area`.
- Mobile: filter state + persistence, route picker (reusing Search), Layers card section, applying the filter to Nearby, map stops and map buses, empty state, Android back.

### Out of scope (do not implement)
- Importing from Google Maps (screenshot OCR, share intent, links) — possible future epic.
- Several named lists, trip legs/order, "next leg" guidance, notifications.
- Typing several routes in one field (`68, 345, 436`); routes are added one search at a time.
- Filtering the Search, Stop, Route or Vehicle panels.
- Any endpoint or field not listed in §4.

---

## 3. Decisions this epic relies on

**Decided by the user (2026-09-19)**

| Topic | Value |
|---|---|
| Entry | Manual: the user chooses the routes. |
| UI | No trip chip. The control lives inside the **Layers** card; the Layers button shows a dot when the filter is active. |
| Reach | Map (buses + stops) and the Nearby list. Search stays global. |
| Lists | A single list, persisted on the phone. |

**Proposed by Claude (architect/PO) and included here; change before executing if you disagree**

| Topic | Value |
|---|---|
| Max routes | 8 (server rejects more with 400). |
| Adding routes | "Add routes" opens Search in **pick mode**: only the Routes section is shown, tapping a row adds/removes it (selected rows show a check + text, not color only), a banner has a "Listo" button. This reuses search, so ambiguities (same number in Metro Transit and MVTA, `436` vs `436V`) are solved by the user seeing and choosing. |
| Auto-enable | Adding the first route turns the filter on; removing the last route turns it off. The switch is disabled while the list is empty. |
| Buses source | With the filter on, buses come from `GET /routes/{id}/vehicles` for each chosen route (no zoom gate, polled every 20 s, paused in background). The area-vehicles layer is off while the filter is on. |
| Stops source | With the filter on, area stops come from `stops/in-area?routeIds=` (same zoom gate 0.03); Nearby stops come from `stops/nearby?routeIds=`. |
| `showVehicles` / `showStops` | Still apply on top of the filter (both are independent of it). |
| Storage key | `route-filter` (AsyncStorage). Stores `{ enabled, routes: [{ id, shortName, color?, textColor? }] }` so badges render offline. |
| Empty Nearby with filter | Specific message that names the filter and how to turn it off. |

---

## 4. Technical specification

### 4.1 API (additive, v1)
- `GET /api/v1/stops/nearby?lat=&lon=&radius=&routeIds=a,b,c`
- `GET /api/v1/stops/in-area?bbox=&routeIds=a,b,c`
- `routeIds`: optional, comma-separated route ids (they contain `:`, e.g. `mvta:436`; the client URL-encodes). 1–8 ids, each non-empty and ≤ 64 chars; anything else → 400 `invalid_request`. Omitted → today's behavior, unchanged.
- Route ids that do not exist are not an error; they simply match no stops.
- Cache headers unchanged (`no-store` for nearby, catalog cache for in-area).

### 4.2 Core and catalog
- `CatalogProvider.findStopsNear`, `findNearestStop` and `findStopsInBounds` gain an optional `options?: { routeIds?: RouteId[] }`. When present, only stops served by at least one of those routes are returned (use the catalog's `route_stops` table). Without it, results are identical to today.
- `getNearby(center, radius?, routeIds?)`:
  1. Stop search (adaptive steps, explicit radius, 5 km fallback) runs **with** the route restriction, so "≥ 3 stops" counts only stops of the chosen routes.
  2. Per stop, arrivals are filtered to the chosen routes **before** taking `nearbyArrivalsPerStop`; `routes` is also filtered to the chosen ones; `approachingVehicles` derives from the filtered arrivals.
- `getStopsInArea(bounds, routeIds?)` passes the restriction to `findStopsInBounds`.
- No logic per route or per agency.

### 4.3 Server
- `apps/server/src/http/params.ts`: `parseRouteIds(params, maxCount)` (pure, tested).
- `TRANSIT_SETTINGS.routeFilterMaxRoutes = 8`.
- Both handlers parse it and pass it to the service; mappers unchanged.

### 4.4 API client
- `getNearbyStops({ lat, lon, radius?, routeIds? })`, `getStopsInArea(bounds, { routeIds? })`; `routeIds` is omitted from the query when empty/undefined.

### 4.5 Mobile
- `features/map/route-filter.ts` (pure): `RouteFilter`, `FilterRoute`, `MAX_FILTER_ROUTES = 8` (comment: mirrors the server setting), `DEFAULT_ROUTE_FILTER`, reducer helpers `toggleRoute`, `removeRoute`, `setEnabled`, `activeRouteIds(filter): string[] | undefined` (defined only when `enabled` and the list is non-empty).
- `features/map/route-filter-storage.ts` (pure `parseStoredRouteFilter`, same tolerance as `parseStoredLayers`, per-field defaults, drops malformed route entries) and `use-route-filter.ts` (load once, save on change; storage errors never throw).
- `features/map/use-filtered-vehicles.ts`: one polled query keyed by the joined ids, `Promise.all` of `getRouteVehicles` per id, flattened and deduped by vehicle id; idle when `routeIds` is undefined.
- `useNearby`, `useAreaStops`: accept `routeIds`; the query key/cache includes them; a change forces a refetch and invalidates the "already fetched area" check in `viewport.ts` usage.
- In the screen: `layerVehicles = routeIds ? filteredVehicles : areaVehicles`, passed as the existing `areaVehicles` argument of `selectMapContent` (no signature change). `useAreaVehicles` is disabled while the filter is on.
- `LayersCard`: new "Rutas" section (switch, badges with a ≥ 44 dp remove target, "Agregar rutas" button). `LayersButton`: dot when `routeIds` is defined (with an accessibility label).
- Search pick mode: `pickingRoutes` screen state; `SearchPanel` receives `pickMode`, `selectedRouteIds`, `onToggleRoute`, `onDone`; it hides the Stops section and shows the banner. Pick mode ends when the panel leaves Search.
- `resolveBackAction` gains `pickingRoutes` with top priority (exit pick mode and return to Nearby).
- Empty Nearby with filter: new state in `NearbyPanel`.

### 4.6 i18n (Spanish values; merge into `es.json`, keep existing keys)
```json
{
  "map": { "layers": { "routes": {
    "title": "Rutas",
    "filterSwitch": "Solo estas rutas",
    "empty": "Agrega las rutas que usarás.",
    "add": "Agregar rutas",
    "remove": "Quitar ruta {{name}}",
    "activeDot": "Filtro de rutas activo"
  } } },
  "routePicker": {
    "title": "Elige las rutas que usarás",
    "hint": "Busca por número y toca para agregar o quitar.",
    "done": "Listo",
    "selected": "Seleccionada",
    "limit": "Máximo {{count}} rutas"
  },
  "nearby": {
    "emptyFiltered": "Ninguna de tus rutas sale cerca en los próximos 90 min.",
    "emptyFilteredHint": "Desactiva el filtro en Capas para ver todo."
  }
}
```

---

## 5. Tasks (stories)

- [ ] **E007-T01 — Server: `routeIds` on nearby and in-area.** *As a rider, I want the server to return only my routes' stops, so the list is not empty when my route's stop is 2 km away.* Server only (+ deploy to Vercel).
  - §4.1–4.4 (core, gtfs catalog adapter, server, api-client).
  - Tests: `parseRouteIds` (valid, empty, >8, too long, whitespace); catalog (`findStopsNear`/`findNearestStop`/`findStopsInBounds` with and without routes; a stop shared by two agencies' routes); core `getNearby` (adaptive radius counts only filtered stops; arrivals filtered before the per-stop limit; `routes` filtered; explicit radius; 5 km fallback with filter); handlers (200, 400, no param = same response as before); api-client query building.
  - Check (after deploy): `curl` nearby at the Eagan test point with `routeIds=mvta:436` returns only 436 arrivals.

- [ ] **E007-T02 — Filter state and persistence.** Client only. Pure model, storage parser, `use-route-filter` (§4.5), tests for every helper (`toggleRoute` at the cap, auto-enable/disable rules, `activeRouteIds`, malformed storage). No visible change yet.

- [ ] **E007-T03 — Pick routes and manage the list.** *As a rider, I want to choose my routes and see/remove them in Capas.* Depends on T02. Client only.
  - Layers card section, dot on the button, search pick mode, banner, cap message, back handling, i18n.
  - Tests: `resolveBackAction` with `pickingRoutes`; pick-mode view-model (routes only, selected flag, cap disables unselected rows).
  - Phone check: add 68, 345 and 436 (choose the right agency when a number appears twice); badges show in Capas; remove one; close and reopen the app: the list and the dot persist. The map does not change yet.

- [ ] **E007-T04 — Apply the filter to Nearby.** Depends on T01, T02. Client only.
  - `useNearby` with `routeIds`; empty filtered state.
  - Phone check: with the filter on, Nearby lists only your routes, even if their stops are farther than 500 m; switching it off restores everything.

- [ ] **E007-T05 — Apply the filter to the map.** Depends on T01, T02, T04.
  - Area stops with `routeIds`, `use-filtered-vehicles`, area vehicles off while filtered, merge in the screen.
  - Tests: `use-filtered-vehicles` merge/dedupe (pure helper), viewport refetch when `routeIds` change.
  - Phone check: only 68/345/436 buses appear (also when zoomed out), stops shown are only those routes' stops, turning the buses/stops layers off still works, turning the filter off restores the EPIC-005 map.

- [ ] **E007-T06 — Close.** `pnpm verify`; update `docs/engineering/mobile.md` (route filter, pick mode), `server.md` (`routeIds`), `architecture.md` if catalog port docs list the methods; index row in `docs/epics/README.md`; header and index set to `Done`; list the decisions introduced in the project decisions document.

---

## 6. Verification
- `pnpm verify` (Biome + typecheck + tests) on the Mac.
- Manual, on the phone, with the user's real trip: 68, 345, 436.

## 7. Risks and stop conditions
- **Forgotten filter:** with no chip, the user may forget it is on and think the app is empty. Mitigations already in the spec: dot on the Layers button and the specific empty message. If field tests show it is not enough, stop and ask before adding any new indicator.
- **Catalog:** if `route_stops` cannot serve the route restriction efficiently or lacks the needed columns, **stop and ask**.
- **Polling:** if `usePolledQuery` cannot re-key on changing ids, stop and describe the limitation instead of adding a library.
- **Search:** if `search` does not return an expected route for an exact number (e.g. `345`), stop and report; do not add per-route logic.
- Never run `git` commands in the user's folder (project rule).

## 8. Open items before execution
- The user confirms the scope note: a route filter is allowed even though "trip planning" stays out of scope.
- Deploy of T01 to Vercel must precede the app build for T04/T05.
