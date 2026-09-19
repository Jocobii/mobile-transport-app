import { describe, expect, it } from "vitest";
import { normalizeHexColor } from "./color";

describe("normalizeHexColor", () => {
  it.each([
    ["771473", "#771473"],
    ["ffffff", "#FFFFFF"],
    ["#FFDF52", "#FFDF52"],
    ["  #ffdf52 ", "#FFDF52"],
  ])("normalizes %j to %s", (input, expected) => {
    expect(normalizeHexColor(input)).toBe(expected);
  });

  it.each([[""], [" "], ["abc"], ["GGGGGG"], ["1234567"], ["#12345"]])(
    "returns undefined for invalid value %j",
    (input) => {
      expect(normalizeHexColor(input)).toBeUndefined();
    },
  );

  it("returns undefined for undefined", () => {
    expect(normalizeHexColor(undefined)).toBeUndefined();
  });
});
