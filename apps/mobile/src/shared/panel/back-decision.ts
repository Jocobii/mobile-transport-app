export type BackAction = "exitPickMode" | "clearHighlightedStop" | "goBack" | "exitApp";

/**
 * Pure Android hardware-back decision. While picking routes for the route filter (E007-T03), back
 * leaves the picker first. In Nearby with a highlighted stop, back clears it instead of leaving
 * the app (E005-T07); every other case keeps the existing stack behavior.
 */
export function resolveBackAction(
  panelKind: "nearby" | "other",
  hasHighlightedStop: boolean,
  canGoBack: boolean,
  pickingRoutes: boolean,
): BackAction {
  if (pickingRoutes) return "exitPickMode";
  if (panelKind === "nearby") {
    return hasHighlightedStop ? "clearHighlightedStop" : "exitApp";
  }
  return canGoBack ? "goBack" : "exitApp";
}
