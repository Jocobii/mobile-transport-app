import { describe, expect, it } from "vitest";
import { vehicleMode, vehicleShape } from "./vehicle-mode";

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
