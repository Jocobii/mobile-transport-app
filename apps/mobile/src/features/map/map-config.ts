/** Downtown Minneapolis: used when the user's location is denied or unavailable. */
export const FALLBACK_CENTER = { lat: 44.9778, lon: -93.265 } as const;

/** Latitude/longitude span (in degrees) of about 2 km, used for the fallback view. */
export const FALLBACK_DELTA = 0.02;

/** Span used when centering on the user or on a stop (~1.3 km). */
export const FOCUS_DELTA = 0.012;

/** Arrow rotation and marker bitmaps refresh in steps of this many degrees. */
export const BEARING_STEP_DEGREES = 15;

/** Padding used when fitting the map to a set of vehicles. */
export const FIT_PADDING = { top: 120, right: 60, bottom: 60, left: 60 };
