# EPIC-008 — Navigation and gestures (panel header, draggable sheet, useful empty stop)

| Field | Value |
|---|---|
| Status | In progress |
| Depends on | EPIC-003, EPIC-005, EPIC-006 (T01–T04 in the tree), EPIC-007 (code in the tree). Independent of EPIC-004. Touches `src/app/index.tsx`, so do not run in parallel with another epic that edits it. |
| Related decisions | Project decisions document, section "EPIC-008" (user, 2026-09-20). **Supersedes two EPIC-003 decisions:** "only the handle drags" and "pull down to refresh". |
| Read first | `AGENTS.md`, `docs/engineering/principles.md`, `mobile.md`, `typescript.md`, `testing.md`, `apps/mobile/AGENTS.md`, `src/shared/components/BottomSheet.tsx`, `src/app/index.tsx` |

---

## 1. Goal

Field test (2026-09-20): selecting a stop shows a floating `←` in the top-left corner of the map. It is
disconnected from the panel it closes, it is a text glyph that renders differently per font, it
replaces the search bar, and it has no title next to it. The sheet can only be dragged from a 40×4 dp
handle, so users feel "there are no gestures". An empty stop says "maybe service has ended" although
the app already knows the next scheduled departure (EPIC-006).

### Definition of success
1. Every panel except Nearby and Search has a header inside the sheet: title (+ subtitle) and a circular **✕** on the right. ✕ = Android back = pop one level. The floating back button is gone.
2. The search bar is visible at the top in every panel (except Search, which shows its input).
3. The sheet can be dragged from its whole header, and dragging a list down when it is scrolled to the top lowers the sheet.
4. Tapping empty map lowers the sheet to `collapsed`.
5. An empty stop shows its next scheduled departure (today or a later day), the routes that serve it and "Ver horario" as the primary action.
6. In Horario, a horizontal swipe changes the day.
7. Android predictive back is enabled; in-app back still walks the panel stack.
8. Every task can be tested on the phone on its own. `pnpm verify` passes.

---

## 2. Scope

### In scope
Mobile only: panel header, icons, search bar placement, follow button placement, sheet gestures, removal of pull-to-refresh, tap-to-refresh freshness, tap map to collapse, empty stop state, timetable day swipe, predictive back flag.

### Out of scope (do not implement)
- Any server, core, contract or api-client change.
- Haptics (`expo-haptics`) — the user chose not to include it.
- Custom in-app predictive back animations (`OnBackAnimationCallback`); only the system flag.
- Swiping the sheet away to close a panel; long-press actions; favorites; pinning "tu parada" from new places.
- Changing snap heights (120 dp / 50 % / full) or the panel stack model.
- Upward drag on the list expanding the sheet (see §3; content scrolls, the header expands).

---

## 3. Decisions this epic relies on

**Decided by the user (2026-09-20)**

| Topic | Value |
|---|---|
| Navigation | Header inside the sheet with title and ✕; search bar fixed at the top; the floating `←` is removed. |
| List drag | Dragging a list down at its top lowers the sheet. **Pull-to-refresh is removed.** Data keeps auto-refreshing every 20 s; the freshness label becomes tappable to refresh now. |
| Empty stop | Next scheduled departure + routes serving the stop, in this epic. |
| Extras | Tap empty map lowers the sheet; horizontal swipe changes the day in Horario; Android predictive back. |

**Proposed by Claude (architect/PO) and included here; change before executing if you disagree**

| Topic | Value |
|---|---|
| ✕ behavior | Pops one level (same as hardware back), not "close everything". Stack depth stays invisible; the title always says where you are. |
| ✕ placement | Top-right of the header, 40 dp visual circle inside a 48 dp touch target, SVG icon, `accessibilityLabel` "Cerrar". |
| Headers | Stop: stop name / "Parada {code} · a {distance}". Horario: stop name / existing subtitle. Route: badge + name / count (existing). Vehicle and Trip: their existing title rows move into the header. Nearby: "Cerca de ti" header without ✕. Search: unchanged (input has its own ✕). |
| Search from a detail panel | Tapping the search bar pushes Search on top of the current panel; closing Search returns to that panel. |
| Follow chip | Moves from the top overlay to a floating map button on the right, above the sheet (same position rule as recenter). |
| Recenter icon | `◎` glyph replaced by an SVG icon (same size, same label). |
| Drag handoff | Only **downward** drags at scroll offset ≤ 0 move the sheet; upward drags on content always scroll the list. The header (and handle) drag in both directions. |
| Tap map | Only when the tap is not on a marker; collapses the sheet and closes the Layers card. It does not pop panels or clear "tu parada". |
| Empty stop lookup | Only when the arrivals list is empty: request the timetable for today; if no departure after `now`, request the next date in `availableDates`; at most 2 requests, no polling. Routes = unique routes of the day that has the departure (today's groups if neither has one). |
| Day swipe | Swipe left = next available date, right = previous; stops at the ends; the selected chip scrolls into view. |
| Freshness tap | Label reads "Actualizado hace X s · Actualizar" with a refresh icon; while a refetch runs it shows "Actualizando…". |

---

## 4. Technical specification

### 4.1 Icons (`src/shared/components/icons/`)
- `CloseIcon`, `RecenterIcon`, `RefreshIcon` in `react-native-svg`, same API as `ChevronIcon` (`size`, `color`, decorative).
- Move `ChevronIcon` into the folder and re-export from its old path only if needed to avoid churn (prefer updating imports).

### 4.2 Panel header
- `src/shared/components/PanelHeader.tsx`: `{ title: ReactNode; subtitle?: ReactNode; onClose?: (() => void) | undefined }`. Title max 2 lines. Without `onClose`, no ✕.
- `src/shared/components/CloseButton.tsx` (replaces `BackButton.tsx`, which is deleted).
- Each panel renders `PanelHeader` wrapped in `SheetDragArea` (§4.3) as its first child and receives `onClose`. Existing in-panel title blocks are replaced, not duplicated.

### 4.3 Sheet gestures (`BottomSheet.tsx`)
- Keep the in-house sheet (gesture-handler + reanimated). No new dependency.
- Expose a context with:
  - `SheetDragArea`: wraps children in a `GestureDetector` with the same pan/tap gesture as the handle.
  - `useSheetScroll()`: returns `{ scrollGesture, scrollHandler }` for a list. Lists become `Animated.FlatList` (reanimated) with `onScroll={scrollHandler}` and `scrollEventThrottle={16}`, wrapped in `GestureDetector gesture={scrollGesture}` where `scrollGesture = Gesture.Native()` simultaneous with a content pan gesture.
  - Content pan: `activeOffsetY([-10, 10])`; on update, if `scrollY.value <= 0` and translation is downward, move the sheet (and keep the list at 0); otherwise do nothing. On end, snap with `resolveSnap` as today.
- Pure logic stays in `shared/panel/sheet-snap.ts`: add `shouldSheetTakeDrag(scrollY, translationY): boolean` (worklet) with tests.
- `collapseSheet()` exposed through the same context or via the existing `onSnapChange` from the screen.

### 4.4 Pull-to-refresh removal and freshness
- Remove `RefreshControl` from `NearbyPanel` and `StopPanel`; delete `use-pull-to-refresh.ts` and its tests if unused.
- `FreshnessLabel` gains optional `onRefresh` and `refreshing`. With `onRefresh` it is a `Pressable` (≥ 44 dp tall), `accessibilityRole="button"`, shows `RefreshIcon` and the "· Actualizar" suffix.
- `usePolledQuery` refetch is the refresh action (no new polling logic). If it exposes no "is fetching" flag, add one in the hook with a test.

### 4.5 Top overlay and map buttons (`index.tsx`)
- `SearchBar` shows for every panel except `search`. Its press pushes `{ kind: "search" }`.
- Remove `BackButton` usages. `FollowChip` renders in a floating container at `right: spacing.lg`, `bottom: panelHeight + spacing.lg` when `panel.kind === "vehicle"`.
- Layers button and zoom hint positions unchanged.

### 4.6 Tap map
- `TransitMap` gains `onMapPress?: () => void`, wired to `MapView.onPress`; ignore events whose `nativeEvent.action === "marker-press"` (Android fires both).
- Screen: `onMapPress = () => { setSnap("collapsed"); setLayersCardOpen(false); }`.

### 4.7 Empty stop (`features/stop/`)
- `use-next-scheduled-departure.ts`: enabled only when `data.arrivals.length === 0`. Uses `api.getStopTimetable(stopId)` and, if needed, `api.getStopTimetable(stopId, nextDate)`. Keyed by stopId; no polling.
- Pure `next-scheduled-departure.ts` (no React Native): `pickNextDeparture(responses, now) → { time, serviceDate, today, route } | undefined` and `routesOf(response) → RouteBadgeInfo[]` (unique by `routeId`, natural order as delivered). Reuse `findNextDeparture` from `shared/format/timetable.ts`.
- `StopPanel` empty state: title "Sin llegadas en los próximos 90 min"; line "Próxima salida programada: {time}" + day label ("hoy", "mañana", or `formatServiceDayLabel`) + route badge of that departure; row "Pasan por aquí:" with badges; primary `ActionButton` "Ver horario". Fallback when nothing is found in 2 days: "No encontramos salidas programadas en los próximos días." The "Ver horario del día" button in the header is hidden in this state (the primary action replaces it).
- Sheet opens at `half`; content is short, so no layout change beyond removing the large empty block.

### 4.8 Timetable day swipe
- Pure `stepServiceDate(availableDates, current, direction: "next" | "previous") → string | undefined` in `shared/format/timetable.ts`, with tests (ends, unknown current).
- `TimetablePanel`: horizontal `Gesture.Pan().activeOffsetX([-24, 24]).failOffsetY([-12, 12])` around the list, simultaneous with the list's native gesture; on end with `|translationX| > 60` call `onSelectDate`.
- `DaySelector` scrolls the selected chip into view when `selectedDate` changes.

### 4.9 Predictive back
- `app.config.ts`: `android.predictiveBackGestureEnabled: true`; run `npx expo prebuild --platform android` (or edit `AndroidManifest.xml` `enableOnBackInvokedCallback="true"` consistently). `resolveBackAction` unchanged.

### 4.10 i18n (merge into `es.json`; keep existing keys)
```json
{
  "common": { "close": "Cerrar" },
  "nearby": { "title": "Cerca de ti" },
  "freshness": {
    "refresh": "Actualizar",
    "refreshing": "Actualizando…",
    "refreshLabel": "Actualizar ahora"
  },
  "stop": {
    "emptyTitle": "Sin llegadas en los próximos 90 min",
    "nextScheduled": "Próxima salida programada: {{time}}",
    "servedBy": "Pasan por aquí:",
    "noUpcomingService": "No encontramos salidas programadas en los próximos días.",
    "openTimetable": "Ver horario"
  },
  "timetable": { "swipeHint": "Desliza para cambiar de día" }
}
```
Keep `nearby.title` if it already exists with another value; do not rename existing keys. Remove keys that become unused (`common.back` only if no longer referenced; `stop.emptyHint`).

---

## 5. Tasks (stories)

- [x] **E008-T01 — Header with ✕ and fixed search bar.** *As a rider, I want to close what I opened from the panel itself and still be able to search.*
  - §4.1, §4.2, §4.5, i18n. Delete `BackButton.tsx`.
  - Tests: none for pure logic beyond existing; `resolveBackAction` tests still pass.
  - Phone check: open a stop, a bus, a route, the timetable: each shows title + ✕; ✕ and Android back behave the same; the search bar is always at the top; searching from a stop and closing search returns to the stop; "Seguir al camión" floats on the right above the sheet.

- [x] **E008-T02 — Drag the sheet from its whole header.** Depends on T01.
  - `SheetDragArea` (§4.3, first bullet); all panel headers wrapped.
  - Phone check: drag the title of any panel up/down; tap the title area does not trigger row presses.

- [x] **E008-T03 — List drag lowers the sheet; tap to refresh.** Depends on T02.
  - `useSheetScroll`, `shouldSheetTakeDrag` (+ tests), lists migrated in Nearby, Stop, Timetable, Route, Vehicle, Search; §4.4.
  - Phone check: scroll a long list, scroll back to top, keep dragging down → sheet lowers; dragging up on content scrolls; tapping "Actualizado hace X s · Actualizar" refetches and shows "Actualizando…"; pull-to-refresh spinner no longer appears.

- [x] **E008-T04 — Tap empty map lowers the sheet.** §4.6.
  - Phone check: tap empty map in every panel → `collapsed`; tapping a stop or bus still opens it and does not collapse first.

- [x] **E008-T05 — Useful empty stop.** §4.7.
  - Tests: `pickNextDeparture` (today later, only tomorrow, none, departures before `now` ignored), `routesOf` (dedupe).
  - Phone check at night (e.g. stop 9675 after service): next departure with day label and badge, "Pasan por aquí" badges, "Ver horario" opens Horario.

- [x] **E008-T06 — Swipe days in Horario.** §4.8.
  - Tests: `stepServiceDate`.
  - Phone check: swipe left/right changes day and chip; vertical scroll still works; ends do nothing.

- [x] **E008-T07 — Android predictive back.** §4.9.
  - Phone check (Android 14+ with the system setting / Android 15+): back gesture walks the panel stack; from Nearby with nothing highlighted the back-to-home preview appears and the app exits.

- [ ] **E008-T08 — Close.** `pnpm verify`; update `docs/engineering/mobile.md` (header, sheet context, gestures, no pull-to-refresh); index row and header to `Done`; record the decisions introduced in the project decisions document.

---

## 6. Verification
- `pnpm verify` on the Mac.
- Manual on the Android phone: every phone check above, plus TalkBack pass on ✕, freshness button and sheet handle.

## 7. Risks and stop conditions
- **Gesture conflicts (T03):** if simultaneous native scroll + pan cannot be made reliable with gesture-handler 2.32 / reanimated 4.5 (list jitters, sheet steals horizontal or row taps), **stop and ask**. Alternative to propose: `@gorhom/bottom-sheet` v5 (new dependency, was avoided in EPIC-003 for compatibility).
- **Map press (T04):** if `MapView.onPress` cannot distinguish marker taps on Android, stop and report instead of adding timers.
- **Predictive back (T07):** if `BackHandler` stops firing with the flag on (RN 0.86), revert the flag and stop and ask.
- **Empty stop (T05):** if the timetable endpoint is not deployed in production (EPIC-006 T05 pending), the empty state must fall back to the plain message; do not block the task, report it.
- Any change to snap heights, stack behavior or server code is out of scope: stop and ask.
- Never run `git` commands in the user's folder (project rule).
