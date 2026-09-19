const METERS_PER_KILOMETER = 1000;
const METER_ROUNDING_STEP = 10;

/** `< 1 km` → meters rounded to 10 m; otherwise kilometers with one decimal. */
export function formatDistance(meters: number): string {
  const roundedMeters = Math.round(meters / METER_ROUNDING_STEP) * METER_ROUNDING_STEP;
  if (roundedMeters < METERS_PER_KILOMETER) return `${roundedMeters} m`;
  return `${(meters / METERS_PER_KILOMETER).toFixed(1)} km`;
}
