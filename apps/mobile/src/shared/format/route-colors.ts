/** Route badge fallback when a route has no official color. Kept here so this module stays free of React Native. */
const FALLBACK = { background: "#1D1D1B", text: "#FFFFFF" } as const;

export interface RouteColors {
  background: string;
  text: string;
}

/**
 * Official GTFS route colors (`#RRGGBB`). Missing `color` -> fallback pair (text color ignored);
 * color without `textColor` -> white text.
 */
export function routeColors(color?: string, textColor?: string): RouteColors {
  if (!color) return { ...FALLBACK };
  return { background: color, text: textColor ?? FALLBACK.text };
}
