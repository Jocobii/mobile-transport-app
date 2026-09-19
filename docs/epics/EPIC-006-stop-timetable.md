# EPIC-006 — Official stop timetable (full-day scheduled departures per stop)

| Field | Value |
|---|---|
| Status | In progress |
| Depends on | EPIC-005 Done (Stop panel, panel stack, sheet snaps). **Independent of EPIC-004** (Route view). |
| Related decisions | Project decisions document: "EPIC-006 — Horario oficial de la parada" (2026-09-19) |
| Read first | `AGENTS.md`, `docs/engineering/architecture.md`, `principles.md`, `mobile.md`, `server.md`, `typescript.md`, `testing.md`, `apps/mobile/AGENTS.md`, `packages/core/AGENTS.md`, `packages/gtfs/AGENTS.md` |

---

## 1. Goal

Many physical stops post a paper sheet with the bus schedule. The app only shows the next arrivals (90 min window,
max 30, live data merged over the schedule), so a rider cannot answer "when does the first bus pass tomorrow?" or
"what time is the last bus tonight?". When service has ended for the day, the Stop panel is simply empty.

This epic adds the **official scheduled timetable of a stop for a whole service day**, using the GTFS static data the
catalog already stores. No new feed, no new table and no new catalog column: only a new query and a new endpoint.

### Definition of success

1. In the Stop panel, a "Ver horario del día" button opens a Timetable panel for that stop.
2. The Timetable lists, for every route and direction (headsign) that serves the stop, all scheduled departures of the
   selected day, grouped by hour, in ascending order.
3. The rider can switch to other days that the catalog covers (today, tomorrow, … up to the last materialized date).
4. When viewing today, passed departures are dimmed and the next departure of each group is highlighted.
5. The timetable is **scheduled only**: no live data, no delays. The panel says so.
6. The button is available even when the Stop panel has no arrivals (service ended).
7. The server work is one indexed SQL query per request; the response for the busiest stop stays small (see budgets).
8. Each task below can be merged and tested on its own, in order.
9. `pnpm verify` passes.

---

## 2. Scope

### In scope
- Core: `TransitService.getStopTimetable`, pure grouping helper, two new `CatalogProvider` port methods.
- GTFS adapter: SQL for one service date at one stop (excluding trip-final stops), and the list of catalog service dates.
- Server: `GET /api/v1/stops/{stopId}/timetable?date=YYYYMMDD` (handler, mapper, route, `date` parser).
- Contracts and `@transit/api-client` (additive, v1).
- Mobile: `timetable` panel, entry button in the Stop panel, hour-grouped layout, day selector, i18n keys.

### Out of scope (do not implement)
- Filtering to **timepoints only** (the printed sheet at some stops lists only timepoints; the catalog does not store
  `timepoint`). See §8, stop condition 1.
- Live overlay on the timetable (delays, cancellations, "en vivo"). Live data stays in the Stop panel.
- Tapping a departure (trip detail / Vehicle view), a route-level timetable, sharing or printing.
- Holiday or special-service labels, service alerts, favorites, English locale.
- Storing new columns in the catalog (`timepoint`, `pickup_type`, `drop_off_type`) or changing catalog size.
- Any route-, stop- or agency-specific logic.

---

## 3. Decisions this epic relies on

Marked **(proposed)** = written by Claude as architect/PO and not yet confirmed by the user in a conversation.
The implementer treats all of them as final; the user can still change them before the epic starts.

| Topic | Value |
|---|---|
| What "official schedule" means | The **GTFS static schedule** published by the agency (Metro Transit, MVTA), as stored in the catalog. Scheduled times only. |
| Which departures are listed | **All scheduled departures at the stop** (not only timepoints). **(proposed)** |
| Trip-final stops | A trip that **ends** at the stop (no later `stop_sequence`) is excluded: nobody boards there. |
| Time used | Departure time (the catalog already stores departure, falling back to arrival). |
| Grouping | One group per `(routeId, directionId, headsign)`, like the Nearby list. Groups ordered by `compareRoutesNaturally(routeId)`, then `directionId`, then `headsign`. |
| Duplicates | Identical epoch times inside the same group are collapsed to one. |
| Service date | `YYYYMMDD` in the stop's feed time zone. A GTFS service day may contain times past 24:00; those departures belong to the requested service date and appear after the last evening hour. |
| Default date | Today's **calendar** date in the time zone of the first feed (in `feeds` config priority order) listed in `stop.feedIds`; `"UTC"` if unknown (same fallback as `getVehicleDetail`). Not service-day-aware. |
| Selectable days | `availableDates` = distinct `service_date` values in the catalog that are **≥ today**, ascending. |
| `date` parameter | Optional, `YYYYMMDD`, must be a real calendar date; otherwise 400 `invalid_request`. A well-formed date outside the catalog returns 200 with `groups: []`. |
| Times in the contract | Unix epoch seconds, like every other contract (DST-correct, computed with the feed time zone). |
| Time display in the app | Device local time zone, 12-hour, with an explicit a. m./p. m. on the **hour label** (the existing arrival clock omits it; that is ambiguous in a full-day list). |
| Layout | Per group: header (route badge + headsign) then one row per hour: hour label on the left, minutes (2 digits) on the right, wrapping. Mirrors the paper sheet. |
| Today marks | Only when the selected date equals `today`: times `< now` dimmed; the first time `≥ now` of each group filled with the route color. `now` comes from the existing `useNow`. |
| Panel behavior | Opens at **full** sheet height (same mechanism as Search). Map shows the stop selected, exactly as in the Stop panel. Back returns to the Stop panel. |
| Cache | Response header `private, max-age=300` (catalog data, same as `stops/in-area`). Client fetches once per `(stopId, date)`; no polling. |
| Days label | "Hoy", "Mañana", then `{weekday} {day}` (e.g. "sáb 20"). Weekday from the `YYYYMMDD` string with UTC math (no device time zone involved). |
| Footnote | "Horario programado publicado por la agencia. No incluye retrasos ni cambios en vivo." |
| New settings / dependencies | None. |

### Budgets (acceptance)

| Budget | Value |
|---|---|
| SQL queries per request | 2 (stop lookup + timetable rows) plus the service-dates list and the routes lookup; all indexed |
| Response size, busiest stop | < 50 KB (departures are plain integers) |
| Warm latency, busiest stop | < 1 s on Vercel (measure; see §8 stop condition 2) |
| Requests from the app | 1 per `(stopId, date)` opened; none while scrolling |

---

## 4. Contract and server changes

### 4.1 `@transit/contracts` (additive, v1)

```ts
/** One route + direction + headsign with its scheduled departures for the day. */
export interface TimetableGroupDto {
  routeId: string;
  routeShortName: string;
  /** `#RRGGBB`, uppercase, or undefined. */
  routeColor?: string | undefined;
  /** `#RRGGBB`, uppercase, or undefined. */
  routeTextColor?: string | undefined;
  directionId: 0 | 1;
  headsign: string;
  /** Scheduled departures, Unix epoch seconds, ascending, unique. */
  times: number[];
}

/** GET /api/v1/stops/{stopId}/timetable?date=YYYYMMDD */
export interface StopTimetableResponse {
  stop: StopSummaryDto;
  /** Requested (or default) service date, `YYYYMMDD`. */
  serviceDate: string;
  /** Today in the stop's feed time zone, `YYYYMMDD`. */
  today: string;
  /** Catalog service dates from `today` on, ascending. Empty when the catalog does not cover today. */
  availableDates: string[];
  groups: TimetableGroupDto[];
}
```

Errors: `date` malformed or not a real calendar date → 400 `invalid_request`; unknown stop → 404 `not_found`;
existing 401 / catalog errors unchanged. No new error code. The route colors follow the same normalization as
`ArrivalDto` (reuse the existing mapper helpers).

### 4.2 `@transit/core`
- Port `CatalogProvider` (`ports.ts`), two additive methods:
  - `getScheduledStopTimesForServiceDate(stopId: StopId, serviceDate: ServiceDate): Promise<ScheduledStopTime[]>`
    — every departure at the stop whose trip runs on `serviceDate`, **excluding trips whose last stop is this one**,
    ascending by `time`.
  - `getServiceDates(): Promise<ServiceDate[]>` — distinct catalog service dates, ascending.
- Pure helper `domain/timetable.ts` (exported from `domain/index.ts`):
  `groupTimetable(stopTimes: ScheduledStopTime[], routes: Route[]): TimetableGroup[]` where
  `TimetableGroup = { route: Route; directionId: DirectionId; headsign: string; times: EpochSeconds[] }`.
  Groups per §3 (order, unique times); entries whose route is not in `routes` are dropped.
- `TransitService.getStopTimetable(stopId: StopId, serviceDate?: ServiceDate): Promise<StopTimetableResult | undefined>`:
  1. `catalog.getStop` → `undefined` when missing.
  2. `today` = `localServiceDate(clock.now(), timezone)` with the timezone rule of §3.
  3. `serviceDate ??= today`.
  4. In parallel: `getScheduledStopTimesForServiceDate`, `getRoutesServingStop`, `getServiceDates`.
  5. `availableDates` = service dates `>= today`.
  6. Return `{ stop, serviceDate, today, availableDates, groups: groupTimetable(...) }`.
  No realtime call, no merge.
- `StopTimetableResult { stop: Stop; serviceDate: ServiceDate; today: ServiceDate; availableDates: ServiceDate[]; groups: TimetableGroup[] }`.

### 4.3 `@transit/gtfs`
- `SqliteCatalogProvider.getScheduledStopTimesForServiceDate`, prepared once:

```sql
SELECT st.trip_id AS tripId, st.stop_sequence AS stopSequence, st.time_seconds AS timeSeconds,
       t.feed_id AS feedId, t.route_id AS routeId, t.direction_id AS directionId, t.headsign AS headsign
FROM stop_times st
JOIN trips t ON t.id = st.trip_id
JOIN service_dates sd ON sd.service_id = t.service_id
WHERE st.stop_id = ? AND sd.service_date = ?
  AND EXISTS (SELECT 1 FROM stop_times nx WHERE nx.trip_id = st.trip_id AND nx.stop_sequence > st.stop_sequence)
```

  Convert each row with `epochFor(serviceDate, timeSeconds, feed.timezone)` using the row's feed (from `feedsCache`),
  fill `ScheduledStopTime` (`serviceDate` = the parameter), sort by `time`. The existing
  `getScheduledStopTimesAtStop` and its statement stay unchanged.
- `getServiceDates`: `SELECT DISTINCT service_date FROM service_dates ORDER BY service_date`.

### 4.4 `apps/server`
- `src/http/params.ts`: `parseServiceDateParam(raw: string | null)` (pure, tested) → `{ ok: true; value: string | undefined } | { ok: false; message }`.
  Absent → `undefined`; must match `^\d{8}$` and round-trip through a UTC `Date` (rejects `20261340`).
- `src/mappers/stop-timetable.ts`: `mapStopTimetableResult(result): StopTimetableResponse`, reusing `mapStop`,
  the route color mapping and `mapRoute` helpers used by `mapArrival`.
- `src/handlers/stop-timetable-handler.ts`: factory with the same deps and error mapping as
  `stop-arrivals-handler.ts` (`parsePathId`, 404 on `undefined`); cache header `private, max-age=300`
  (reuse the constant used by `stops-in-area-handler.ts`).
- Route file `app/api/v1/stops/[stopId]/timetable/route.ts` (same 6-line pattern as the arrivals route). `x-api-key` required.

### 4.5 `@transit/api-client`
- `getStopTimetable(stopId: string, options: { date?: string } = {})` →
  `/stops/${encodeURIComponent(stopId)}/timetable${buildQuery({ date })}`. Test the URL with and without `date`.

---

## 5. Mobile design

### 5.1 New and changed files

```
src/shared/panel/panel-state.ts        + Panel { kind: "timetable"; stopId: string }, isSamePanel case, reducer tests
src/shared/panel/back-decision.ts      timetable behaves like any non-Nearby panel (pop); extend tests
src/shared/format/timetable.ts         pure: groupTimesByHour, findNextDeparture, formatServiceDayLabel
src/features/stop/StopPanel.tsx        + "Ver horario del día" button (ActionButton), prop onOpenTimetable
src/features/timetable/
  TimetablePanel.tsx                   header, day selector, groups, footnote, loading/empty/error states
  TimetableGroupView.tsx               route badge + headsign + hour rows
  DaySelector.tsx                      horizontal chips (≥ 44 dp), selected chip filled
  use-stop-timetable.ts                one-shot query keyed by (stopId, date); pattern of use-route-shape.ts
src/app/index.tsx                      render TimetablePanel for kind "timetable"; open it at full snap; map + focus
                                       branches that handle `kind === "stop"` also handle "timetable"
                                       (find them with a search for `kind === "stop"`, including select-map-content)
```

### 5.2 Pure logic (`shared/format/timetable.ts`, no React Native import)

- `groupTimesByHour(times: number[]): HourRow[]` with `HourRow = { key: string; hour12: number; period: "am" | "pm"; minutes: { time: number; text: string }[] }`.
  Rows follow input order; a new row starts when the local calendar date or local hour changes (device time zone).
  `text` = 2-digit minutes. An after-midnight departure of the same service day therefore lands in a later row
  ("12 a. m.", "1 a. m."), after the evening rows.
- `findNextDeparture(times: number[], now: number): number | undefined` — the first `time >= now`.
- `formatServiceDayLabel(date, today, labels)` → "Hoy" / "Mañana" / `{weekday} {day}`; `labels = { today, tomorrow, weekdays: string[7] }`
  (index 0 = Sunday); tomorrow = `today + 1` day, computed with UTC math.

### 5.3 i18n additions (`es.json`)

```json
"stop": {
  "viewTimetable": "Ver horario del día"
},
"timetable": {
  "title": "Horario",
  "hour": "{{hour}} {{period}}",
  "am": "a. m.",
  "pm": "p. m.",
  "today": "Hoy",
  "tomorrow": "Mañana",
  "weekdays": ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"],
  "note": "Horario programado publicado por la agencia. No incluye retrasos ni cambios en vivo.",
  "empty": "No hay salidas en esta parada este día.",
  "emptyHint": "Prueba con otro día."
}
```
(merge into the existing `stop` object; keep existing keys. If the app's i18n setup cannot return arrays, use
`timetable.weekday.0` … `.6` instead; do not change the labels.)

### 5.4 Behavior details
- `TimetablePanel` keeps `selectedDate: string | undefined` in local state (undefined → server default = today).
  Changing the day changes the query key; the previous data is not shown while the new one loads (loading state).
- The `DaySelector` shows `availableDates` in order; the selected chip is `selectedDate ?? today`.
  Hidden when `availableDates.length <= 1`.
- Accessibility: chips and the entry button ≥ 44 dp with labels; a departure's state (passed / next) is never conveyed
  by color alone (dimmed + next is filled and bold).
- Color rules: route color only on the badge and the "next" chip; status colors are not used here (the timetable has no status).
- `useNow` refreshes the dimming/highlight without refetching.

---

## 6. Tasks (stories)

- [x] **E006-T01 — Catalog query and domain grouping.** *As the system, I can list a stop's scheduled departures for a
  service date.* Depends on: none. `@transit/core` + `@transit/gtfs`.
  - Port methods (§4.2), `groupTimetable`, `getStopTimetable`, SQL and `getServiceDates` (§4.3). Update every fake
    `CatalogProvider` (`transit-service.test.ts`, server `test-helpers.ts` if it implements the port).
  - Tests (gtfs, with the existing fixture catalog): only the requested date; a trip-final stop is excluded; a
    `25:10` time becomes the next calendar day's epoch; ascending order; a stop shared by two feeds returns both;
    `getServiceDates` distinct and ascending.
  - Tests (core): `groupTimetable` (grouping key, natural route order, direction/headsign order, duplicate collapse,
    unknown route dropped, empty input); `getStopTimetable` (unknown stop → `undefined`; default date uses the feed
    time zone: with `now = 2026-09-20T03:00Z` today is `20260919`; explicit date; `availableDates` filtered `>= today`;
    no realtime call, spy on the fake providers).
  - Done when: `pnpm --filter @transit/core --filter @transit/gtfs test` passes.

- [x] **E006-T02 — Timetable endpoint.** (code done; deploy to Vercel still pending) *As a client, I can request a stop's timetable.* Depends on: T01.
  Contracts + server + api-client. **Deploy to Vercel before the app build.**
  - §4.1, §4.4, §4.5.
  - Tests: `parseServiceDateParam` (absent, valid, `2026-09-19`, `abc`, `20261340`, `20260231`, empty string);
    mapper (colors normalized, epoch times preserved, empty groups); handler (200 + `private, max-age=300`,
    400 bad date, 404 unknown stop, 401 without key); api-client URL with and without `date`.
  - Deploy check (human): `curl -H "x-api-key: …" "$API/api/v1/stops/56939/timetable"` → groups with ascending times;
    `…/timetable?date=20260920` → next day; `?date=2026-09-20` → 400.

- [x] **E006-T03 — Timetable panel for today.** *As a rider, I can open the stop's schedule for today.*
  Depends on: T02. Mobile only.
  - Panel state + back decision (§5.1), `shared/format/timetable.ts` (`groupTimesByHour`, `findNextDeparture`),
    `use-stop-timetable.ts`, `TimetablePanel` and `TimetableGroupView` (no day selector yet, default date),
    entry button in `StopPanel` (visible whenever the stop data is loaded), full-height open, map/focus branches, i18n.
  - Tests: `panel-state` (push, same-panel dedupe, back), `back-decision` (timetable pops), `groupTimesByHour`
    (row split by hour and by date, after-midnight row order, minute padding, 12 a. m./12 p. m.), `findNextDeparture`
    (before first, between, after last, exact match), `select-map-content` if that file has a per-panel switch.
  - Phone check: open a stop → "Ver horario del día" → every route/direction of that stop with hour rows; passed times
    are dimmed and each group's next time is filled; back returns to the Stop panel; at night (no arrivals in the
    Stop panel) the button still opens the full-day schedule.

- [x] **E006-T04 — Day selector.** *As a rider, I can see the schedule of tomorrow or another day.*
  Depends on: T03. Mobile only.
  - `DaySelector`, `formatServiceDayLabel`, local `selectedDate`, query per date, dimming/highlight only on `today`.
  - Tests: `formatServiceDayLabel` (today, tomorrow, another day, month rollover, weekday index); hook query-key
    change if it is pure-testable, otherwise cover in the phone check.
  - Phone check: tomorrow and a Sunday show different departures (weekday vs weekend service); no dimming/highlight on
    other days; a day with no service at that stop shows the empty state.

- [ ] **E006-T05 — Closing.** (docs updated; pending: `pnpm verify` on the Mac, deploy, phone checks of T03/T04) `pnpm verify`; update `docs/engineering/architecture.md` (use case `getStopTimetable`,
  two port methods), `server.md` (endpoint list, if it has one) and `mobile.md` (Timetable panel, hour grouping);
  set this epic and the index in `docs/epics/README.md` to `Done`; list the decisions introduced during
  implementation for the project decisions document.

---

## 7. Verification

1. `pnpm verify`.
2. After deploying the server:
   - `curl -H "x-api-key: …" "$API/api/v1/stops/56939/timetable"` (MSP T1, shared by both agencies) → groups from both
     Metro Transit and MVTA routes; times ascending; `today` equals the current Minneapolis date.
   - Same stop with `?date=` on a Saturday and a Sunday → different group contents.
   - A terminus stop (last stop of some route): that route's arrivals *into* the terminus are not listed.
   - `?date=20261340` → 400 `invalid_request`; unknown stop id → 404.
   - Latency of the first and second call for the busiest downtown stop (record the numbers).
3. `npx expo run:android` (human): the phone checks of T03 and T04, plus a stop served by many routes (long list
   scrolls smoothly) and a low-service suburban stop (few groups, few times).

---

## 8. Risks and stop conditions

1. **The paper sheet may list fewer times than the app** (timepoints only). If the user compares and reports a
   mismatch, stop: the fix is a product decision (store `timepoint`, filter or mark timepoints) and a catalog
   change, not part of this epic. Do not guess or filter by heuristic.
2. **Busiest stops are slow or large** (latency > 1 s warm, response > 50 KB): report the numbers and stop. Do not add
   caching libraries or new indexes without asking.
3. **`EXISTS` semantics for trip-final stops** are wrong for a loop route whose first and last stop are the same
   stop id: the boarding departure at the start must remain. If the fixture or real data shows a missing
   first departure at such a stop, stop and ask (the rule would need `stop_sequence` awareness).
4. **Times shown in the device time zone**, like the arrival clocks: a phone outside America/Chicago shows shifted
   hours. Known limitation; do not add a time-zone library.
5. `getServiceDates` returning nothing (empty catalog) must not crash: `availableDates: []` and an empty state.
6. Any need for agency- or route-specific logic, or an endpoint/field beyond §4: stop and ask.
