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
    polling/        poll controller + use-polled-query (20 s, paused in background)
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
- Only the handle drags, so lists keep scrolling; the content area is sized to the current snap height.
- Snap logic is pure and tested (`shared/panel/sheet-snap.ts`). Search opens full; other panels open at half.
- The map padding and the recenter button follow the sheet only up to the half height.

## Vehicle view

- `features/vehicle/`: polled `useVehicleDetail`, one-time `useRouteShape`, `useVehicleView` (segment to the user's
  stop, one fit per vehicle, follow mode), pure `stopsUntil` and `segmentToStop`.
- Follow mode re-centers on every refresh keeping the zoom (`panTo`); dragging the map turns it off and the chip resumes it.
- Variants: live, passed, canceled/skipped, gone (vehicle left the feed) and Trip (scheduled, nothing to poll).
- Map markers are bitmaps, so screen-reader access to vehicles and stops goes through the lists, not the markers.
