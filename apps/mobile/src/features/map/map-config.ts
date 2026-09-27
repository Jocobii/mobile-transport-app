/** Downtown Minneapolis: used when the user's location is denied or unavailable. */
export const FALLBACK_CENTER = { lat: 44.9778, lon: -93.265 } as const;

/** Latitude/longitude span (in degrees) of about 2 km, used for the fallback view. */
export const FALLBACK_DELTA = 0.02;

/** Span used when centering on the user or on a stop (~1.3 km). */
export const FOCUS_DELTA = 0.012;

/** Initial/recenter span in Nearby: fits the largest adaptive Nearby radius (1500 m → ~0.027°),
 * so it stays inside the stops zoom gate and stops and buses show right at start. */
export const NEARBY_FOCUS_DELTA = 0.027;

/** Padding used when fitting the map to a set of vehicles. */
export const FIT_PADDING = { top: 120, right: 60, bottom: 60, left: 60 };

/** Stops layer (EPIC-005): visible only when `latitudeDelta <= this` (~3.3 km tall). */
export const STOPS_ZOOM_GATE_DELTA = 0.03;

/** Buses layer (EPIC-005): visible only when `latitudeDelta <= this` (~16 km tall). Outside
 * this gate only approaching buses (today's behavior) are drawn. */
export const VEHICLES_ZOOM_GATE_DELTA = 0.15;

/** Fetch-area rule (EPIC-005): how much the visible region is padded and grid-snapped
 * before being sent as `bbox`, and how long to wait after the map settles before fetching. */
export const AREA_EXPAND_FACTOR = 0.25;
export const AREA_SNAP_GRID_DEGREES = 0.005;
export const AREA_FETCH_DEBOUNCE_MS = 400;

/**
 * Bus label detail by zoom, so downtown doesn't turn into a pile of labels:
 * `latitudeDelta <= FULL` (~1.6 km tall) shows the full label (bus glyph, number, outdated clock);
 * `<= NUMBER` (~6.5 km tall) shows the route number only; farther out only the heading puck.
 */
export const VEHICLE_LABEL_FULL_MAX_DELTA = 0.015;
export const VEHICLE_LABEL_NUMBER_MAX_DELTA = 0.06;

/** Longest route name drawn on a map label; longer ones are cut with "…" (full name in panels). */
export const MAP_ROUTE_NAME_MAX_CHARS = 8;
