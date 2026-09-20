import { describe, expect, it } from "vitest";
import {
  resolveSnap,
  type SnapOffsets,
  shouldSheetTakeDrag,
  stepSnap,
  tapSnap,
} from "./sheet-snap";

const OFFSETS: SnapOffsets = { full: 0, half: 300, collapsed: 600 };

describe("resolveSnap", () => {
  it("picks the nearest snap point when released without velocity", () => {
    expect(resolveSnap(20, 0, OFFSETS)).toBe("full");
    expect(resolveSnap(280, 0, OFFSETS)).toBe("half");
    expect(resolveSnap(590, 0, OFFSETS)).toBe("collapsed");
  });

  it("lets a downward fling carry the sheet to the next lower point", () => {
    expect(resolveSnap(200, 600, OFFSETS)).toBe("half");
    expect(resolveSnap(400, 1500, OFFSETS)).toBe("collapsed");
  });

  it("lets an upward fling carry the sheet to the next higher point", () => {
    expect(resolveSnap(400, -600, OFFSETS)).toBe("half");
    expect(resolveSnap(200, -1500, OFFSETS)).toBe("full");
  });
});

describe("resolveSnap (easy to move)", () => {
  it("lets a moderate upward flick leave the collapsed point", () => {
    expect(resolveSnap(600, -700, OFFSETS)).toBe("half");
  });

  it("lets a moderate downward flick collapse from half", () => {
    expect(resolveSnap(300, 700, OFFSETS)).toBe("collapsed");
  });
});

describe("tapSnap", () => {
  it("opens from collapsed, grows from half and returns to half from full", () => {
    expect(tapSnap("collapsed")).toBe("half");
    expect(tapSnap("half")).toBe("full");
    expect(tapSnap("full")).toBe("half");
  });
});

describe("stepSnap", () => {
  it("moves one snap point at a time and stops at the ends", () => {
    expect(stepSnap("collapsed", "up")).toBe("half");
    expect(stepSnap("half", "up")).toBe("full");
    expect(stepSnap("full", "up")).toBe("full");
    expect(stepSnap("full", "down")).toBe("half");
    expect(stepSnap("half", "down")).toBe("collapsed");
    expect(stepSnap("collapsed", "down")).toBe("collapsed");
  });
});

describe("shouldSheetTakeDrag", () => {
  it("takes a downward drag when the list is at the top", () => {
    expect(shouldSheetTakeDrag(0, 12)).toBe(true);
  });

  it("treats a negative offset (overscroll) as the top", () => {
    expect(shouldSheetTakeDrag(-4, 12)).toBe(true);
  });

  it("leaves a downward drag to the list while it is scrolled", () => {
    expect(shouldSheetTakeDrag(80, 12)).toBe(false);
  });

  it("leaves an upward drag to the list even at the top", () => {
    expect(shouldSheetTakeDrag(0, -12)).toBe(false);
  });

  it("does not take a drag that has not moved", () => {
    expect(shouldSheetTakeDrag(0, 0)).toBe(false);
  });
});
