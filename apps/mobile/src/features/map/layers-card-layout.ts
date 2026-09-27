/**
 * Tallest the Layers card may grow. It opens upward from `cardBottom` (distance from the screen's
 * bottom edge), so without a limit a long route list pushed it under the search bar and the
 * status bar. It must stop `gap` below `searchBarBottom` (distance from the screen's top edge).
 */
export function layersCardMaxHeight({
  screenHeight,
  cardBottom,
  searchBarBottom,
  gap,
}: {
  screenHeight: number;
  cardBottom: number;
  searchBarBottom: number;
  gap: number;
}): number {
  return Math.max(0, screenHeight - cardBottom - searchBarBottom - gap);
}
