# EPIC-003 — Mobile redesign v2 (route-first nearby, vehicle view, official colors, status colors, gestures)

| Field | Value |
|---|---|
| Status | Ready |
| Depends on | EPIC-002 closed (E002-T11). If E002-T11 is still open, do it first. |
| Related decisions | Project decisions document: "EPIC-002 — App móvil (MVP)" → field test 2026-09-19 and redesign v2; wireframes canvas "Wireframes EPIC-002", row 4 ("Rediseño v2") and its notes |
| Read first | `AGENTS.md`, `docs/engineering/mobile.md`, `architecture.md`, `principles.md`, `typescript.md`, `testing.md`, `apps/mobile/AGENTS.md`, SDK 57 versioned docs |

---

## 1. Goal

The MVP works but confuses a first-time user: identical default pins, a black label that does not read as a bus,
a stop-first list with truncated destinations, duplicated stops per direction, no action when tapping an arrival and
no link between list and map. This epic redesigns the app so it answers, at a glance:
**which bus is mine, where it goes, when it arrives, and where it is now.**

### Definition of success

1. Nearby lists **route + destination** rows (not stops): full destination, boarding stop and distance, next two times.
2. Route badges and bus markers use the **official GTFS colors** with the official text color; missing color → fallback.
3. Every arrival time and status chip uses the **status color system** (§5): green / amber / red / gray, always with
   icon + text.
4. Tapping a live arrival opens the **Vehicle view**: the map follows the bus, shows the route segment to the user's
   stop, "Llega a tu parada en X min · faltan N paradas", and the upcoming stops with ETAs.
5. Stops are small neutral circles; the selected stop grows and shows its name; Google POIs are hidden.
6. The bottom sheet is draggable with three snap points; pull-to-refresh works; list and map are linked.
7. The search bar and map controls respect the safe area.
8. `pnpm verify` passes.

---

## 2. Scope

### In scope
- Contract + server: route colors on arrivals and vehicles; hex normalization.
- Mobile: route colors, status color system, new markers, map style, route-first Nearby, Vehicle view,
  draggable sheet, pull-to-refresh, list↔map linking, safe area fixes, Stop panel restyle.
- New on-time threshold (§5.2).

### Out of scope (do not implement)
- Full Route view (shape + stop list + direction selector) — becomes **EPIC-004**.
- Favorites, recents, notifications, service alerts, English locale, dark theme.
- Marker clustering.
- App name, icon, splash.
- Any endpoint or field not listed in §4.

---

## 3. Decisions this epic relies on

| Topic | Value |
|---|---|
| Nearby grouping | One row per **(routeId, headsign)** across all nearby stops. Boarding stop = the nearest stop (smallest `distanceMeters`) that has an arrival for that group. Times = that stop's arrivals for the group, ordered, first two with `status: "normal"` shown; a canceled/skipped arrival is shown only if it is the first one. Rows ordered by first arrival time. Stops with no arrivals do not produce rows. |
| Route color | Badge and bus marker background = `routeColor`; text = `routeTextColor`. If `routeColor` is missing → background `#1D1D1B` and text `#FFFFFF` (ignore `routeTextColor`). If `routeColor` exists but `routeTextColor` is missing → text `#FFFFFF`. |
| Route color vs status color | Route color only paints badges and bus markers. Status colors only paint times, status chips and banners. They never mix. |
| Status colors | §5. |
| Adelantado | Amber (risk of missing the bus), message "Sale X min antes". |
| On-time threshold | On time when `-60 < delaySec < 120`. Late from 120 s; early from 60 s before (§5.2). |
| Vehicle view entry | Tap a Nearby row, a Stop arrival or a bus marker. Only live arrivals with `vehicleId` open the full view; scheduled arrivals open the "no live position" variant (§6.3). |
| Vehicle segment on map | Polyline of the route shape (`getRouteDetail(routeId, { directionId })`) cut from the point nearest the bus to the point nearest the user's stop (§7.3). If the shape is unavailable, draw straight segments through `upcomingStops` up to the user's stop. |
| Follow mode | The map follows the bus on each refresh until the user pans; a chip "Seguir al camión" re-enables it. |
| Bottom sheet | Snap points: collapsed (header only, ~120 dp), half (50 % of screen), full (screen minus search bar area). Default: half. Library: `@gorhom/bottom-sheet` v5 installed with `npx expo install`; if it does not run with Reanimated 4.5 / RN 0.86, implement a minimal sheet in `src/shared/components/BottomSheet.tsx` with `react-native-gesture-handler` + `react-native-reanimated` (same three snap points). Do not stop for this; record which one was used. |
| Pull-to-refresh | On the Nearby and Stop lists; calls `refetch()` of the active polled query. |
| Map style | Google `customMapStyle` hiding `poi` and `transit` features/labels; roads and neighborhood labels stay. Stored in `features/map/map-style.ts`. |
| Refresh | Unchanged: 20 s, paused in background. Vehicle view polls `getVehicleDetail` at the same interval. |

---

## 4. Contract and server changes

### 4.1 `@transit/contracts`
- `ArrivalDto`: add `routeTextColor?: string | undefined`.
- `VehicleDto`: add `routeColor?: string | undefined` and `routeTextColor?: string | undefined`.
- Document on every color field (`RouteSummaryDto.color/textColor`, `ArrivalDto.routeColor/routeTextColor`,
  `VehicleDto.routeColor/routeTextColor`): **`#RRGGBB`, uppercase, or undefined**.

### 4.2 `apps/server`
- New `src/mappers/color.ts`: `normalizeHexColor(value: string | undefined): string | undefined` — trims, strips a
  leading `#`, accepts exactly 6 hex digits, returns `#` + uppercase; anything else → `undefined`. Tests: `771473`,
  `ffffff`, `#FFDF52`, `""`, `" "`, `abc`, `GGGGGG`, undefined.
- Use it in every mapper that emits a color (route summary, arrival, vehicle, route detail, route vehicles).
- `mapVehicle` already receives `route`: set `routeColor` / `routeTextColor` from it.
- Arrival mapper: set `routeTextColor` from the route (same source as `routeColor`).
- Tests for each changed mapper (fields present, normalized, undefined when missing).
- `@transit/api-client`: no code change expected; update its tests only if types require it.

---

## 5. Status color system (mobile)

### 5.1 Tokens (`src/shared/theme.ts`, replace `live`/`problem` usage)

| Status | Text/icon | Background (chips, banners) | Icon | Meaning |
|---|---|---|---|---|
| `ok` | `#1F7A4D` | `#E6F2EA` | live signal | Live and on time |
| `attention` | `#8A5300` | `#FCEFD6` | warning triangle | Late or early |
| `problem` | `#A3281C` | `#FBE6E3` | circle-x | Canceled or skipped |
| `neutral` | `#55544F` | `#EFEEE9` | calendar | Scheduled (no live data) |

Canceled/skipped times: `#8A8984`, struck through. Neutral (scheduled) times use `ink` (`#1D1D1B`), only the chip is gray.
Icons are inline SVG via `react-native-svg` if already available through Expo, else simple `View` shapes — no emoji,
no icon font download. (Check with `npx expo install react-native-svg`; it is part of the Expo SDK.)

### 5.2 `formatArrivalStatus` (replace the EPIC-002 rules)

Returns `{ key, params?, status: "ok" | "attention" | "problem" | "neutral" }`:
1. `status === "canceled"` → `arrival.canceled`, `problem`.
2. `status === "skipped"` → `arrival.skipped`, `problem`.
3. `source === "scheduled"` → `arrival.scheduled`, `neutral`.
4. live, `delaySec` undefined → `arrival.liveOnTime`, `ok`.
5. live, `delaySec >= 120` → `arrival.liveLate` `{ minutes: round(delaySec / 60) }`, `attention`.
6. live, `delaySec <= -60` → `arrival.liveEarly` `{ minutes: max(1, round(-delaySec / 60)) }`, `attention`.
7. otherwise → `arrival.liveOnTime`, `ok`.

Update its tests: boundaries at 119/120 and −59/−60, undefined delay, each status.

### 5.3 Where status colors apply
- Big time number and unit: status text color (canceled: struck gray; scheduled: ink).
- Status chip under the destination: background + text + icon of the status.
- Vehicle view header card: `ok` background when on time; `attention` background when late/early.
- Banner in the Vehicle view when the user's stop becomes canceled/skipped (§6.3).

---

## 6. Screens (match canvas row 4)

### 6.1 Map (all panels)
- **Stop marker:** 14 dp white circle, 2.5 dp `#6D6C67` border. Selected: 22 dp `ink` fill, 3 dp white border, shadow,
  plus a small white label with the stop name next to it. Custom `Marker` children with `tracksViewChanges` turned off
  after first render (same technique as `VehicleMarker`).
- **Bus marker:** pill (route color background, 2 dp white border, shadow) with a bus glyph + route short name in the
  route text color; a separate 20 dp white circle at the top-right with a small arrow in the route color, rotated by
  `bearing` (hidden when no bearing). Live vehicles get a faint halo in the route color.
- `customMapStyle` from §3. Search bar, back and recenter buttons offset by `useSafeAreaInsets().top`.
- Tapping a bus marker opens the Vehicle view for that vehicle.

### 6.2 Nearby (route-first)
- Header: "Cerca de ti", subtitle "{routes} rutas · {stops} paradas a menos de {distance}" (plural via i18n), freshness label.
- Row (`NearbyRouteRow`): route badge (official colors) · destination "→ {headsign}" up to 2 lines (no truncation to one
  line) · status chip · boarding stop "{stopName} · {distance}" · right column: big first time (status color) and
  "luego {n} min" for the second arrival when present.
- Tapping a row: highlights its boarding stop on the map and, if the first arrival is live with `vehicleId`,
  opens the Vehicle view; otherwise opens the "no live position" variant.
- Empty (no rows): "No hay salidas en los próximos 90 min cerca de ti."
- Pull-to-refresh. Existing loading/error/outsideRadius states keep working.

### 6.3 Vehicle view (new panel kind)
Panel state gains `{ kind: "vehicle"; vehicleId: string; stopId: string; routeId: string; directionId: 0 | 1 }`
(and, for scheduled arrivals, `{ kind: "trip"; arrival: ArrivalDto; stopId: string }` — no polling of a vehicle).

Live variant:
- Header: back button (map overlay), chip "Siguiendo al camión" / "Seguir al camión" (map overlay, top-right).
- Panel: badge + "→ {headsign}"; status card "Llega a tu parada en {min} min" with status chip and
  "faltan {n} paradas" (plural) and "posición de hace {s} s" (from `vehicle.updatedAt`).
- Timeline of `upcomingStops`: route-colored vertical line, dots, name, ETA; user's stop bold with a "tu parada" tag.
  Show from the next stop up to 2 stops after the user's stop.
- Map: segment polyline in the route color (width 6), user's stop selected, bus marker, fit to both on open.
- If the user's stop is no longer in `upcomingStops` (bus passed it): card "El camión ya pasó por tu parada" (neutral)
  and a button "Ver llegadas de la parada" → Stop panel.
- If the user's stop in `upcomingStops` has `status` canceled/skipped: red banner "Tu camión fue cancelado" /
  "Este camión no pasará por tu parada", with "Ver llegadas de la parada" → Stop panel.
- If `getVehicleDetail` returns `not_found` (vehicle left the feed): neutral card "Ya no hay ubicación en vivo de este
  camión" + "Ver llegadas de la parada".

Scheduled variant (`trip`): badge + destination, scheduled time big (ink), chip "Programado",
text "Este viaje todavía no reporta su ubicación." + "Ver llegadas de la parada".

### 6.4 Stop panel (restyle only)
Keep the time-ordered list. Apply official badge colors, status chips and time colors, 2-line destinations,
pull-to-refresh; tapping an arrival opens the Vehicle view (§6.3).

### 6.5 Search and Route vehicles panels
Only apply official badge colors and the new bus marker. No behavior change.

---

## 7. Pure logic to implement and test

### 7.1 `groupNearbyByRoute(response: NearbyStopsResponse): NearbyRouteGroup[]`
In `features/nearby/`. Implements the grouping rule of §3. Tests: two stops serving the same group (nearest wins),
two headsigns of the same route (two rows), stop without arrivals (no row), ordering by first time, canceled first arrival.

### 7.2 `routeColors(color?: string, textColor?: string): { background: string; text: string }`
In `shared/format/`. Implements the fallback rules of §3. Tests for all four combinations.

### 7.3 `segmentToStop(shape: LatLon[], bus: LatLon, stop: LatLon): LatLon[]`
In `features/vehicle/`. Index of the shape point nearest the bus and nearest the stop (haversine from
`shared/geo`); returns the slice between them (inclusive), in travel order; returns `[bus, stop]` when the shape is
empty or the stop index is before the bus index. Tests with a small synthetic shape.

### 7.4 `stopsUntil(upcomingStops, stopId): { remaining: number; target?: UpcomingStopDto; passed: boolean }`
Tests: stop ahead, stop is next (remaining 0), stop not present (passed), canceled target.

### 7.5 `formatArrivalStatus` — §5.2.

---

## 8. i18n additions (`es.json`)
`nearby.subtitle` (plural), `nearby.emptyRoutes`, `nearby.then`, `vehicle.arrivesIn`, `vehicle.stopsLeft` (plural),
`vehicle.positionAge`, `vehicle.yourStop`, `vehicle.follow`, `vehicle.following`, `vehicle.passed`,
`vehicle.canceled`, `vehicle.skipped`, `vehicle.gone`, `vehicle.noLivePosition`, `vehicle.seeStopArrivals`,
`arrival.liveEarly` ("Sale {{minutes}} min antes"), `arrival.liveLate` ("{{minutes}} min tarde"),
`arrival.liveOnTime` ("En vivo · a tiempo"), `arrival.scheduled` ("Programado"), `map.busMarkerLabel`
(accessibility: "Camión {{route}} hacia {{headsign}}"), `map.stopMarkerLabel`. All user-visible text via i18n.

---

## 9. Tasks

Execute in order. Mark each checkbox. Commit per task (Conventional Commits, English).

- [x] **E003-T01 — Contract and server colors.** §4. Tests first. `pnpm verify`.
- [x] **E003-T02 — Theme and status system.** §5.1 tokens, §5.2 `formatArrivalStatus` (tests), `StatusChip`,
  `StatusIcon`, `routeColors` (§7.2, tests), `RouteBadge` with official colors. `react-native-svg` via `npx expo install` if needed.
- [x] **E003-T03 — Map style and markers.** `map-style.ts`, new `StopMarker` (normal/selected + label),
  new `VehicleMarker` (§6.1), safe-area offsets for overlays.
- [x] **E003-T04 — Bottom sheet.** §3 bottom sheet decision; replace `BottomPanel`; three snap points; keep Android back behavior.
- [x] **E003-T05 — Route-first Nearby.** `groupNearbyByRoute` (§7.1, tests), `NearbyRouteRow`, header, empty state,
  pull-to-refresh, row ↔ map highlight.
- [x] **E003-T06 — Vehicle view.** Panel kinds (reducer tests), `useVehicleDetail` (polled), `segmentToStop` and
  `stopsUntil` (tests), live/scheduled/passed/canceled/gone variants, follow mode, bus marker tap.
- [ ] **E003-T07 — Stop, Search and Route vehicles restyle.** §6.4, §6.5.
- [ ] **E003-T08 — Accessibility and polish.** Labels on markers and icon buttons, touch targets ≥ 44 dp,
  status never by color alone, distances without monospace, no Spanish outside `es.json`.
- [ ] **E003-T09 — Closing.** `pnpm verify`; update `docs/engineering/mobile.md` (feature folders `vehicle/`,
  status system, sheet); set epic and index to `Done`; list decisions introduced for the decisions document.

---

## 10. Verification

1. `pnpm verify`.
2. `npx expo run:android` on the device (human), with real data:
   - Nearby shows one row per route + destination; the 68 badge is purple (`#771473`) with white text.
   - A late bus shows the amber time and "X min tarde"; on-time shows green; scheduled shows "Programado" in gray.
   - Tapping a live row opens the Vehicle view: map follows the bus, purple segment to the stop, "faltan N paradas".
   - Panning stops following; "Seguir al camión" resumes it.
   - Dragging the sheet snaps to three heights; pull-to-refresh updates the freshness label.
   - No Google POIs on the map; the search bar is below the status bar.
3. `curl` an arrival and a vehicle endpoint in production after deploy: colors as `#RRGGBB`.

---

## 11. Risks and stop conditions

- `@gorhom/bottom-sheet` incompatibility: use the in-house fallback (§3); do not stop.
- Custom markers performance with many stops: keep `tracksViewChanges` off after render; if the map stutters on the
  device, report it (clustering is out of scope).
- `getRouteDetail` shape for a direction different from the vehicle's: always pass the vehicle's `directionId`.
- Any need for a new endpoint, or for agency- or route-specific logic: stop and ask.
- Server change must deploy to Vercel before the app build that depends on it (the app must tolerate missing
  color fields anyway via the fallback).
