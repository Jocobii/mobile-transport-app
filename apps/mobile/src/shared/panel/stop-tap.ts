import type { Panel } from "./panel-state";

export type StopTapAction = "open" | "close";

/**
 * What tapping a stop marker on the map does: tapping the stop whose Stop panel is already open
 * closes it (same as ✕); any other stop opens its panel.
 */
export function resolveStopTap(panel: Panel, stopId: string): StopTapAction {
  return panel.kind === "stop" && panel.stopId === stopId ? "close" : "open";
}
