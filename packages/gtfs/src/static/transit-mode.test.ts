import { describe, expect, it } from "vitest";
import { transitMode } from "./transit-mode";

describe("transitMode", () => {
  it("maps basic GTFS route types", () => {
    expect(transitMode("3", "Local", undefined)).toBe("bus");
    expect(transitMode("0", "Light rail", undefined)).toBe("lightRail");
    expect(transitMode("2", "Commuter rail", undefined)).toBe("rail");
    expect(transitMode("1", "Subway", undefined)).toBe("rail");
  });

  it("maps extended (hierarchical) route types", () => {
    expect(transitMode("900", "Tram", undefined)).toBe("lightRail");
    expect(transitMode("106", "Regional rail", undefined)).toBe("rail");
    expect(transitMode("401", "Metro", undefined)).toBe("rail");
    expect(transitMode("702", "Express bus", undefined)).toBe("bus");
  });

  it("marks a bus as BRT when its long name starts with the feed's BRT prefix", () => {
    expect(transitMode("3", "METRO A Line", "METRO ")).toBe("brt");
    expect(transitMode("3", "Green Line Bus", "METRO ")).toBe("bus");
    expect(transitMode("3", "METRO A Line", undefined)).toBe("bus");
  });

  it("keeps rail routes as rail even when they match the BRT prefix", () => {
    expect(transitMode("0", "METRO Blue Line", "METRO ")).toBe("lightRail");
  });

  it("falls back to bus for missing or unknown types", () => {
    expect(transitMode(undefined, "", undefined)).toBe("bus");
    expect(transitMode("", "", undefined)).toBe("bus");
    expect(transitMode("4", "Ferry", undefined)).toBe("bus");
  });
});
