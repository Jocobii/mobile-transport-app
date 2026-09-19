import type { UpcomingStopDto } from "@transit/contracts";
import { describe, expect, it } from "vitest";
import type { Position } from "@/shared/geo/position";
import { fallbackSegment, segmentToStop } from "./segment-to-stop";

/** Straight west-to-east line, one point every ~0.001 degrees of longitude. */
const SHAPE: Position[] = [0, 1, 2, 3, 4, 5].map((step) => ({
  lat: 44.9,
  lon: -93.2 + step * 0.001,
}));

const at = (step: number): Position => ({ lat: 44.9, lon: -93.2 + step * 0.001 });

describe("segmentToStop", () => {
  it("cuts the shape between the point nearest the bus and the one nearest the stop", () => {
    expect(segmentToStop(SHAPE, at(1.1), at(3.9))).toEqual([SHAPE[1], SHAPE[2], SHAPE[3], SHAPE[4]]);
  });

  it("returns bus and stop when the shape is empty", () => {
    expect(segmentToStop([], at(1), at(3))).toEqual([at(1), at(3)]);
  });

  it("returns bus and stop when the stop is behind the bus", () => {
    expect(segmentToStop(SHAPE, at(4), at(1))).toEqual([at(4), at(1)]);
  });

  it("returns bus and stop when both snap to the same shape point", () => {
    expect(segmentToStop(SHAPE, at(2.1), at(2.2))).toEqual([at(2.1), at(2.2)]);
  });
});

describe("fallbackSegment", () => {
  it("goes through the upcoming stops up to the target", () => {
    const stops = ["1", "2", "3"].map(
      (id, index): UpcomingStopDto => ({
        stop: { id, code: id, name: id, lat: 44.9, lon: -93.2 + index * 0.01 },
        stopSequence: index,
        time: 1000,
        source: "live",
        status: "normal",
      }),
    );
    const bus = { lat: 44.9, lon: -93.21 };
    const segment = fallbackSegment(bus, stops, 1);
    expect(segment).toHaveLength(3);
    expect(segment[0]).toBe(bus);
    expect(segment[2]).toMatchObject({ id: "2" });
  });
});
