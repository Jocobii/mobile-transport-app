export type SheetSnap = "collapsed" | "half" | "full";

/** Vertical translation (dp, 0 = fully open) of the sheet at each snap point. */
export interface SnapOffsets {
  collapsed: number;
  half: number;
  full: number;
}

/** How far ahead (seconds) a fling is projected when picking the snap point. */
const PROJECTION_SECONDS = 0.15;

/** Snap point nearest to where the sheet would rest, given its offset and release velocity. */
export function resolveSnap(offset: number, velocityY: number, offsets: SnapOffsets): SheetSnap {
  "worklet";
  const projected = offset + velocityY * PROJECTION_SECONDS;
  const toFull = Math.abs(projected - offsets.full);
  const toHalf = Math.abs(projected - offsets.half);
  const toCollapsed = Math.abs(projected - offsets.collapsed);
  if (toFull <= toHalf && toFull <= toCollapsed) return "full";
  if (toHalf <= toCollapsed) return "half";
  return "collapsed";
}

/** Next larger (`up`) or smaller (`down`) snap point; stays put at the ends. */
export function stepSnap(snap: SheetSnap, direction: "up" | "down"): SheetSnap {
  if (direction === "up") return snap === "collapsed" ? "half" : "full";
  return snap === "full" ? "half" : "collapsed";
}
