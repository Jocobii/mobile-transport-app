import { describe, expect, it } from "vitest";
import type { Panel } from "./panel-state";
import { resolveStopTap } from "./stop-tap";

describe("resolveStopTap", () => {
  it("opens a stop from Nearby", () => {
    expect(resolveStopTap({ kind: "nearby" }, "s1")).toBe("open");
  });

  it("closes the stop whose panel is already open", () => {
    expect(resolveStopTap({ kind: "stop", stopId: "s1" }, "s1")).toBe("close");
  });

  it("opens a different stop while a stop panel is open", () => {
    expect(resolveStopTap({ kind: "stop", stopId: "s1" }, "s2")).toBe("open");
  });

  it("opens the stop from panels that only mention it", () => {
    const panels: Panel[] = [
      { kind: "timetable", stopId: "s1" },
      { kind: "vehicle", vehicleId: "v", stopId: "s1", routeId: "r", directionId: 0 },
    ];
    for (const panel of panels) expect(resolveStopTap(panel, "s1")).toBe("open");
  });
});
