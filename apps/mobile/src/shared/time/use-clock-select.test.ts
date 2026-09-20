import { describe, expect, it } from "vitest";
import { shallowEqual } from "./use-clock-select";

describe("shallowEqual", () => {
  it("is true for objects with the same values", () => {
    expect(shallowEqual({ a: "1", b: false }, { a: "1", b: false })).toBe(true);
  });

  it("is false when a value differs", () => {
    expect(shallowEqual({ a: "1" }, { a: "2" })).toBe(false);
  });

  it("is false when the keys differ", () => {
    expect(shallowEqual({ a: "1" } as object, { a: "1", b: "2" } as object)).toBe(false);
  });
});
