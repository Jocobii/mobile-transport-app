# apps/mobile (Expo)

## Framework version

Expo SDK 57 / React Native 0.86. Read the versioned docs at https://docs.expo.dev/versions/v57.0.0/
before using any Expo or React Native API.

## Architecture inside the app

```
src/app/            Expo Router screens (thin: compose hooks + components)
src/features/<x>/   feature folders: nearby, stop, route, vehicle, search
    components/     presentational components (props in, UI out, no data fetching)
    hooks/          data hooks (use @transit/api-client), view-model logic
src/shared/         cross-feature UI components, formatting, theme tokens
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

- The map is always visible; content lives in a bottom sheet with levels: Nearby → Stop → Route → Vehicle.
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
