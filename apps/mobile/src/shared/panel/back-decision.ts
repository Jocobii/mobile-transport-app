export type BackAction = "clearHighlightedStop" | "goBack" | "exitApp";

/**
 * Pure Android hardware-back decision (E005-T07). In Nearby with a highlighted stop, back
 * clears it instead of leaving the app; every other case keeps the existing stack behavior.
 */
export function resolveBackAction(
  panelKind: "nearby" | "other",
  hasHighlightedStop: boolean,
  canGoBack: boolean,
): BackAction {
  if (panelKind === "nearby") {
    return hasHighlightedStop ? "clearHighlightedStop" : "exitApp";
  }
  return canGoBack ? "goBack" : "exitApp";
}
