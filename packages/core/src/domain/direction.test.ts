import { describe, expect, it } from "vitest";
import type { RoutePattern } from "../model";
import { selectRoutePattern } from "./direction";

const DIR0: RoutePattern = {
  id: "r:0",
  routeId: "r",
  directionId: 0,
  headsign: "Downtown",
  stops: [{ id: "s1", lat: 44.9, lon: -93.2, code: "s1", name: "S1", feedIds: [] }],
  shape: [],
};
const DIR1: RoutePattern = {
  id: "r:1",
  routeId: "r",
  directionId: 1,
  headsign: "Uptown",
  stops: [{ id: "s2", lat: 45.0, lon: -93.3, code: "s2", name: "S2", feedIds: [] }],
  shape: [],
};

describe("selectRoutePattern (10.12)", () => {
  it("returns not_found when there are no patterns", () => {
    expect(selectRoutePattern([], {})).toEqual({ ok: false, reason: "not_found" });
  });

  it("uses the given directionId when it exists", () => {
    const result = selectRoutePattern([DIR0, DIR1], { directionId: 1 });
    expect(result.ok).toBe(true);
    expect(result.ok && result.pattern.id).toBe("r:1");
  });

  it("reports invalid_direction when the given directionId has no pattern", () => {
    const result = selectRoutePattern([DIR0], { directionId: 1 });
    expect(result).toEqual({ ok: false, reason: "invalid_direction" });
  });

  it("chooses the direction whose pattern has the closest stop to near", () => {
    const result = selectRoutePattern([DIR0, DIR1], { near: { lat: 44.9, lon: -93.2 } });
    expect(result.ok).toBe(true);
    expect(result.ok && result.pattern.id).toBe("r:0");
  });

  it("falls back to the lowest directionId with no directionId or near", () => {
    const result = selectRoutePattern([DIR1, DIR0], {});
    expect(result.ok).toBe(true);
    expect(result.ok && result.pattern.id).toBe("r:0");
  });
});
