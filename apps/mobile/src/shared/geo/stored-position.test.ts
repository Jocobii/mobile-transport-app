import { describe, expect, it } from "vitest";
import { parseStoredPosition } from "./stored-position";

describe("parseStoredPosition", () => {
  it("reads a valid position", () => {
    expect(parseStoredPosition(JSON.stringify({ lat: 44.98, lon: -93.27 }))).toEqual({
      lat: 44.98,
      lon: -93.27,
    });
  });

  it("gives undefined for missing or malformed data", () => {
    expect(parseStoredPosition(null)).toBeUndefined();
    expect(parseStoredPosition("not json")).toBeUndefined();
    expect(parseStoredPosition("42")).toBeUndefined();
    expect(parseStoredPosition("null")).toBeUndefined();
  });

  it("rejects a field that is missing, not a number or out of range", () => {
    expect(parseStoredPosition(JSON.stringify({ lat: 44.98 }))).toBeUndefined();
    expect(parseStoredPosition(JSON.stringify({ lat: "44.98", lon: -93.27 }))).toBeUndefined();
    expect(parseStoredPosition(JSON.stringify({ lat: 91, lon: -93.27 }))).toBeUndefined();
    expect(parseStoredPosition(JSON.stringify({ lat: 44.98, lon: -181 }))).toBeUndefined();
  });
});
