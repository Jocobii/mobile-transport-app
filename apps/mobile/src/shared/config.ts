/** How often the active panel's query is refreshed while the app is in the foreground. */
export const REFRESH_INTERVAL_MS = 10_000;

/**
 * How old a vehicle's GPS position can be before the app flags it as outdated: a clock with the
 * age on the map marker and the `vehicle.outdatedPosition` notice in the Vehicle view.
 * Independent from the server's `realtimeStaleAfterSeconds` (120 s), which drops the vehicle from
 * the feed entirely; this never hides it. Starting estimate, to be tuned with the `realtime.lag`
 * server logs (see claude/desfase-posicion-camiones.md).
 */
export const VEHICLE_POSITION_WARN_AFTER_SECONDS = 60;

/** Query length limit enforced by the server. */
export const SEARCH_MAX_LENGTH = 50;

/** Wait after the last keystroke before searching. */
export const SEARCH_DEBOUNCE_MS = 300;
