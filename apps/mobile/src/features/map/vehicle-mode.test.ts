import { describe, expect, it } from "vitest";
import { labelDetailForMode, vehicleMode, vehicleShape } from "./vehicle-mode";

describe("vehicleMode", () => {
  it("returns the mode the server sent", () => {
    expect(vehicleMode({ mode: "lightRail" })).toBe("lightRail");
    expect(vehicleMode({ mode: "brt" })).toBe("brt");
  });

  it("falls back to bus when the server sends no mode", () => {
    expect(vehicleMode({})).toBe("bus");
  });

  it("falls back to bus for a mode this app does not know yet", () => {
    // A newer server may add modes; the contract says to draw them as buses.
    expect(vehicleMode({ mode: "ferry" as never })).toBe("bus");
  });
});

describe("vehicleShape", () => {
  it("draws buses and BRT round, trains square", () => {
    expect(vehicleShape("bus")).toBe("round");
    expect(vehicleShape("brt")).toBe("round");
    expect(vehicleShape("lightRail")).toBe("square");
    expect(vehicleShape("rail")).toBe("square");
  });
});

describe("labelDetailForMode", () => {
  it("keeps a train's route name visible when bus labels are hidden", () => {
    expect(labelDetailForMode("none", "lightRail")).toBe("number");
    expect(labelDetailForMode("none", "rail")).toBe("number");
  });

  it("hides bus and BRT labels at the zoom where they are hidden", () => {
    expect(labelDetailForMode("none", "bus")).toBe("none");
    expect(labelDetailForMode("none", "brt")).toBe("none");
  });

  it("does not change the detail when labels are already shown", () => {
    expect(labelDetailForMode("full", "lightRail")).toBe("full");
    expect(labelDetailForMode("number", "bus")).toBe("number");
  });
});
