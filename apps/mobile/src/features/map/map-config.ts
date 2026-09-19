/** Downtown Minneapolis: used when the user's location is denied or unavailable. */
export const FALLBACK_CENTER = { lat: 44.9778, lon: -93.265 } as const;

/** Latitude/longitude span (in degrees) of about 2 km, used for the fallback view. */
export const FALLBACK_DELTA = 0.02;

/** Span used when centering on the user or on a stop (~1.3 km). */
export const FOCUS_DELTA = 0.012;

/** Initial/recenter span in Nearby: fits the largest adaptive Nearby radius (1500 m → ~0.027°),
 * so it stays inside the stops zoom gate and stops and buses show right at start. */
export const NEARBY_FOCUS_DELTA = 0.027;

/** Arrow rotation and marker bitmaps refresh in steps of this many degrees. */
export const BEARING_STEP_DEGREES = 15;

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
