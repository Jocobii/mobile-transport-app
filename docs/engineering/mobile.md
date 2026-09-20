# apps/mobile (Expo)

## Framework version

Expo SDK 57 / React Native 0.86. Read the versioned docs at https://docs.expo.dev/versions/v57.0.0/
before using any Expo or React Native API.

## Architecture inside the app

```
src/app/            Expo Router screens (thin: compose hooks + components)
src/features/<x>/   feature folders: nearby, stop, route, search, map, vehicle (panel components, data hooks and
                    pure view-model logic with their tests live side by side, flat inside the folder)
src/shared/         cross-feature code:
    components/     shared UI (RouteBadge, StatusChip, StatusIcon, BottomSheet, NoticeCard, SearchBar, ...)
    format/         pure formatting (arrival status/time, route colors, distance, freshness)
    geo/            position helpers
    panel/          panel state machine (reducer + hook) and sheet snap logic; the map never unmounts
    polling/        poll controller + use-polled-query (10 s, paused in background)
    theme.ts        design tokens
src/i18n/           i18n setup and locale files (es first, en later)
src/api/            api client instance and configuration
```

- **Screens are thin.** They read route params, call hooks and render components.
- **Presentational components** receive data and callbacks via props; they do not fetch.
- **Data access only through `@transit/api-client`.** Never import `@transit/core` or `@transit/gtfs`.
- **No business rules in the app.** The server returns merged, filtered, ordered data.
  The app formats and displays it.

## Labels and i18n (the only Spanish in the codebase)

- Every user-visible string goes through the i18n function: text, buttons, placeholders, empty states,
  errors and **accessibility labels**.
- Keys are English and namespaced by feature: `stop.nextArrivals`, `arrival.minutesAway`, `common.retry`.
- Values live in `src/i18n/locales/es.json` (Spanish). `en.json` is added later with the same keys.
- Use interpolation and plural rules from the i18n library; never concatenate translated fragments.
- Code, component names, comments and test names stay in English.

## UX rules from the product decisions

- The map is always visible; content lives in a draggable bottom sheet. Panels: Nearby → Stop → Vehicle (or Trip);
  Search and Route vehicles hang off Nearby. The full Route view is EPIC-004.
- Anything tappable must look tappable: card/border, chevron and an explicit action line (learned in the field test).
- The arrival time is the most prominent element.
- Always show whether an arrival is **live** or **scheduled**, and data freshness when relevant.
- Loading, empty, error and offline states are designed for every screen (never a blank screen).
- Location permission denied must still leave the app usable (map + search).

## Device and data

- Refresh intervals come from configuration; pause refreshing when the app is in the background.
- Do not store or send the user's location anywhere except the API request that needs it.
- Environment: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_API_KEY`. Read them in `src/api/` only.

## Components

- Function components and hooks only.
- Keep components small; extract when a component mixes layout, formatting and state.
- Use design tokens from `src/shared/theme` instead of raw colors and sizes.
- Lists use virtualized components (`FlatList`/`SectionList`), not `map` inside `ScrollView`, for long data.
- Touch targets and contrast follow platform accessibility guidelines.

## Status and route colors

- **Route color** (official GTFS `#RRGGBB`, normalized by the server) paints only route badges and bus markers.
  Missing color -> `#1D1D1B` with white text; color without text color -> white text (`shared/format/route-colors.ts`).
- **Status color** paints only times, status chips and banners: `ok` green, `attention` amber (late or early),
  `problem` red (canceled/skipped), `neutral` gray (scheduled). Tokens in `shared/theme.ts`.
- Status is never shown by color alone: always icon (`StatusIcon`) + text (`StatusChip`, `NoticeCard`).
- On time is `-60 < delaySec < 120` (`formatArrivalStatus`).

## Bottom sheet

- In-house `shared/components/BottomSheet.tsx` (`react-native-gesture-handler` + `react-native-reanimated`),
  not `@gorhom/bottom-sheet`. Three snap points: collapsed (120 dp), half (50 %, default), full (below the search bar).
- The handle, every panel header (`PanelHeader` wraps its content in `SheetDragArea`) and the top of a list drag the
  sheet; the content area is sized to the current snap height.
- Snap logic is pure and tested (`shared/panel/sheet-snap.ts`, including `shouldSheetTakeDrag`). Search opens full; other panels open at half.
- The map padding and the recenter button follow the sheet only up to the half height.

## Vehicle view

- `features/vehicle/`: polled `useVehicleDetail`, one-time `useRouteShape`, `useVehicleView` (segment to the target
  stop, one fit per vehicle, follow mode), pure `stopsUntil`, `segmentToStop` and `resolveSegmentTarget`.
- Follow mode re-centers on every refresh keeping the zoom (`panTo`); dragging the map turns it off and the chip resumes it.
- Variants: live, passed, canceled/skipped, gone (vehicle left the feed) and Trip (scheduled, nothing to poll).
- Map markers are bitmaps, so screen-reader access to vehicles and stops goes through the lists, not the markers.
- **Opening a bus** (`resolve-vehicle-stop.ts`, pure): tapping any bus marker in Nearby, Search or Route resolves a
  stop context: "my stop" if the bus approaches it, otherwise no stop. A stop is never picked automatically, and
  opening a bus never sets "my stop" itself.
- **Nearby initial view**: on start and recenter the map frames `NEARBY_FOCUS_DELTA` (~1500 m, the largest adaptive
  Nearby radius), inside the stops zoom gate, so stops and buses show immediately.
- **Vehicle view without a stop**: same panel and follow mode, no "Llega a tu parada…" line and no "faltan N
  paradas". Timeline shows the next 10 upcoming stops; the route segment runs to the last upcoming stop instead
  (`resolveSegmentTarget`); first fit centers the bus alone (`TransitMapHandle.fitTo` degrades to `focusOn` with a
  single point).
- **Bus stops on the map** (`vehicle-map-content.ts`, pure `buildVehicleMapContent`): the Vehicle view draws every
  upcoming stop (deduped by id), not only the target; the resolved stop (if any) stays the selected marker. Tapping
  any of them opens the Stop panel like elsewhere on the map.

## Map layers and the visible-area viewport (EPIC-005)

- **Layer toggles** (`features/map/map-layers.ts`, `use-map-layers.ts`): `showVehicles` / `showStops`, both on by
  default, only applied to the Nearby and Search panels (`select-map-content.ts`). Persisted to `AsyncStorage`
  (`map-layers-storage.ts`, pure `parseStoredLayers`: defaults for missing, malformed or partial data), loaded once
  on mount and saved on every change.
- **Adaptive Nearby radius** (`@transit/core` `getNearby`): widens the search radius in configured steps until it
  has enough stops, independent of the viewport layers below.
- **Viewport-driven layers** (`viewport.ts`, pure): `stops/in-area` and `vehicles/in-area` are cheap,
  position-agnostic endpoints — positions only, no arrivals. `TransitMap.onRegionChangeComplete` feeds a debounced
  region (`AREA_FETCH_DEBOUNCE_MS`, `useDebouncedValue`) into `useAreaStops` / `useAreaVehicles`, each gated by its
  own zoom level (`STOPS_ZOOM_GATE_DELTA` ≈ 3.3 km, `VEHICLES_ZOOM_GATE_DELTA` ≈ 16 km — outside it only approaching
  buses show, as before this epic) and capped/expanded/grid-snapped (`AREA_EXPAND_FACTOR`, `AREA_SNAP_GRID_DEGREES`)
  so panning inside an already-fetched area does not refetch. `useAreaVehicles` also polls every 10 s
  (`REFRESH_INTERVAL_MS`) while active. `ZoomHint` tells the user to zoom in when the stops layer is on but gated
  out.
- `select-map-content.ts` merges the area layers with the existing ones, deduped by id: area stops merge with
  Nearby stops; area vehicles merge with approaching vehicles, with the approaching version winning (it carries the
  stop it approaches, so tapping it still opens the Vehicle view — non-approaching bus markers get no `onPress`
  unless "Opening a bus" resolves a stop for them).
- **Clearing "my stop"** (`MyStopChip`, `shared/panel/back-decision.ts`): shown under the search bar in Nearby while
  a stop is highlighted, hidden once it falls out of the Nearby data. Android back clears it before it ever walks
  the panel stack (pure `resolveBackAction`, tested for every `nearby | other panel` × `stop set | not set` case).

## Stop timetable (EPIC-006)

- **Panel `timetable`** (`Panel { kind: "timetable"; stopId }`, `features/timetable/`): opened from the Stop panel's
  "Ver horario del día" button (visible whenever the stop data is loaded, also when there are no arrivals). Opens at
  full sheet height like Search; the map behaves as in the Stop panel (`select-map-content.ts` treats `timetable` like
  `stop`); back returns to the Stop panel (`resolveBackAction` needs no change: it is an "other" panel).
- **Data**: `useStopTimetable` fetches `stops/{id}/timetable` once per `(stopId, date)` (catalog data, no polling).
  `useTimetableView` adds the selected day (scoped to the stop) and keeps `days` (stop, today, selectable dates) from
  the latest response so the header and the day chips stay on screen while another day loads.
- **Pure logic** (`shared/format/timetable.ts`, no React Native import): `formatClockTime` (`h:mm` + am/pm, device
  time zone), `groupTimesByDayPart` (early morning < 5 h ≤ morning < 12 h ≤ afternoon < 19 h ≤ night; departures on a
  later local date than the first one go to "after midnight"), `typicalHeadwayMinutes` (median gap, 5-min rounding from
  10 min, only with ≥ 4 departures), `formatCountdown`, `splitPassedTimes`, `findNextDeparture`,
  `formatServiceDayLabel` (UTC date math, no device time zone), `stepServiceDate`.
- **Rendering** (redesign 2026-09-20): per route/direction a card with the route badge and headsign; today only, a
  "Próxima salida" box (full clock time + countdown, or "Ya no hay más salidas hoy"); a meta line with count, typical
  headway, first and last; then full clock times in a 4-column grid under day-part labels. Today, passed departures are
  hidden behind a "Ver N salidas anteriores" toggle (dimmed when shown); the next one is filled with the route color and
  bold (never color alone). Times use the system font with `tabular-nums` (no monospace). The panel says the schedule is
  scheduled only (`timetable.note`). `DaySelector`'s `ScrollView` has `flexShrink: 0` so the chips are not clipped.

## Navigation and gestures (EPIC-008)

- **Panel header** (`shared/components/PanelHeader.tsx`, `CloseButton.tsx`): every panel except Nearby and Search
  starts with a title (+ subtitle) and a circular ✕ (40 dp circle in a 48 dp target, SVG icon). ✕ pops one level, like
  Android back. There is no floating back button. Icons live in `shared/components/icons/` (SVG, never text glyphs).
- **Search bar** is fixed at the top in every panel except Search; from a detail panel it pushes Search on top and closing
  Search returns there. "Seguir al camión" floats on the right above the sheet, like recenter.
- **Sheet gestures** (`BottomSheet.tsx`): a context exposes `createDragGesture` (headers; pan only, no tap toggle) and
  `createContentPanGesture` (lists). Lists use `SheetFlatList` / `SheetSectionList` / `SheetScrollView`
  (`SheetLists.tsx`): reanimated scroll handler + native gesture simultaneous with the content pan. Only a **downward**
  drag with the list at its top moves the sheet (`shouldSheetTakeDrag`); upward drags scroll. Lists do not bounce.
- **No pull-to-refresh.** Data still refreshes every 20 s (`usePolledQuery`, which now exposes `isFetching`); the
  freshness label in Nearby and Stop is a button ("Actualizado hace X s · Actualizar" / "Actualizando…").
- **Tap map** (`TransitMap.onMapPress`, marker taps ignored via `action === "marker-press"`) collapses the sheet and closes
  the Layers card; it does not pop panels or clear "my stop".
- **Empty stop** (`features/stop/`): with no arrivals, `useNextScheduledDeparture` requests today's timetable and, if
  nothing is left, the next available day's (max 2 requests, no polling). Pure `pickNextDeparture`, `routesOf`,
  `summarizeEmptyStop`, `dateAfter` in `next-scheduled-departure.ts`. On error only the plain title shows.
- **Timetable day swipe**: horizontal pan (`activeOffsetX` 24, `failOffsetY` 12, commit > 60 dp) calls pure
  `stepServiceDate`; `DaySelector` scrolls the selected chip into view.
- **Predictive back**: `predictiveBackGestureEnabled: true` (`app.config.ts`); in-app back still goes through
  `resolveBackAction`.
