/** How often the active panel's query is refreshed while the app is in the foreground. */
export const REFRESH_INTERVAL_MS = 10_000;

/**
 * How old a vehicle's GPS position can be before the Vehicle view flags it as outdated
 * (`vehicle.positionAgeStale`). Independent from the server's `realtimeStaleAfterSeconds`
 * (120 s), which decides when a vehicle is dropped from the feed entirely — this only
 * changes how the age label looks; it never hides the vehicle. Starting estimate, not yet
 * measured against real feed behavior (see claude/auditoria-performance.md, S1/F9).
 */
export const VEHICLE_POSITION_WARN_AFTER_SECONDS = 60;

/** Query length limit enforced by the server. */
export const SEARCH_MAX_LENGTH = 50;

/** Wait after the last keystroke before searching. */
export const SEARCH_DEBOUNCE_MS = 300;
