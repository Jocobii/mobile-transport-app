import { describe, expect, it } from "vitest";
import { resolveSnap, type SnapOffsets, stepSnap } from "./sheet-snap";

const OFFSETS: SnapOffsets = { full: 0, half: 300, collapsed: 600 };

describe("resolveSnap", () => {
  it("picks the nearest snap point when released without velocity", () => {
    expect(resolveSnap(20, 0, OFFSETS)).toBe("full");
    expect(resolveSnap(280, 0, OFFSETS)).toBe("half");
    expect(resolveSnap(590, 0, OFFSETS)).toBe("collapsed");
  });

  it("lets a downward fling carry the sheet to the next lower point", () => {
    expect(resolveSnap(200, 1500, OFFSETS)).toBe("half");
    expect(resolveSnap(400, 1500, OFFSETS)).toBe("collapsed");
  });

  it("lets an upward fling carry the sheet to the next higher point", () => {
    expect(resolveSnap(400, -1500, OFFSETS)).toBe("half");
    expect(resolveSnap(200, -1500, OFFSETS)).toBe("full");
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
