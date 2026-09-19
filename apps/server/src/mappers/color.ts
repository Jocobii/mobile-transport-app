const HEX_COLOR = /^[0-9a-fA-F]{6}$/;

/**
 * Normalizes a GTFS color to `#RRGGBB` (uppercase). Returns `undefined` when the value
 * is missing or is not exactly six hex digits (optionally prefixed with `#`).
 */
export function normalizeHexColor(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  const digits = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  return HEX_COLOR.test(digits) ? `#${digits.toUpperCase()}` : undefined;
}
