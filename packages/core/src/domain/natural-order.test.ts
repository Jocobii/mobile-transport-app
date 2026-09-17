import { describe, expect, it } from "vitest";
import { compareNaturally, compareRoutesNaturally } from "./natural-order";

describe("compareNaturally", () => {
  it("orders digit runs numerically, not lexicographically", () => {
    const sorted = ["54", "9", "100"].sort(compareNaturally);
    expect(sorted).toEqual(["9", "54", "100"]);
  });
});

describe("compareRoutesNaturally", () => {
  it("orders prefixed route ids by their embedded route number", () => {
    const sorted = ["metrotransit:54", "metrotransit:9", "metrotransit:100"].sort(
      compareRoutesNaturally,
    );
    expect(sorted).toEqual(["metrotransit:9", "metrotransit:54", "metrotransit:100"]);
  });
});
