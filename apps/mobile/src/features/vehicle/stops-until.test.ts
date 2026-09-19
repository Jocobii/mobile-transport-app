import type { UpcomingStopDto } from "@transit/contracts";
import { describe, expect, it } from "vitest";
import { stopsUntil } from "./stops-until";

function upcoming(id: string, overrides: Partial<UpcomingStopDto> = {}): UpcomingStopDto {
  return {
    stop: { id, code: id, name: `Stop ${id}`, lat: 44.9, lon: -93.2 },
    stopSequence: Number(id),
    time: 1000,
    source: "live",
    status: "normal",
    ...overrides,
  };
}

const STOPS = [upcoming("1"), upcoming("2"), upcoming("3")];

describe("stopsUntil", () => {
  it("counts the stops before a target that is ahead", () => {
    const result = stopsUntil(STOPS, "3");
    expect(result.remaining).toBe(2);
    expect(result.target?.stop.id).toBe("3");
    expect(result.passed).toBe(false);
  });

  it("reports zero remaining when the target is the next stop", () => {
    expect(stopsUntil(STOPS, "1")).toMatchObject({ remaining: 0, passed: false });
  });

  it("reports the vehicle as passed when the stop is not upcoming", () => {
    expect(stopsUntil(STOPS, "9")).toEqual({ remaining: 0, passed: true });
  });

  it("still returns a canceled target so the view can warn about it", () => {
    const result = stopsUntil([upcoming("1"), upcoming("2", { status: "canceled" })], "2");
    expect(result.target?.status).toBe("canceled");
    expect(result.passed).toBe(false);
  });

  it("has no target and is never passed with no stop context (E005-T08)", () => {
    expect(stopsUntil(STOPS, undefined)).toEqual({ remaining: 0, passed: false });
  });
});
