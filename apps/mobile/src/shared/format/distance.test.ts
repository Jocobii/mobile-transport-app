import { describe, expect, it } from "vitest";
import { formatDistance } from "./distance";

describe("formatDistance", () => {
  it("rounds distances under one kilometer to the nearest 10 m", () => {
    expect(formatDistance(0)).toBe("0 m");
    expect(formatDistance(234)).toBe("230 m");
    expect(formatDistance(235)).toBe("240 m");
  });

  it("switches to kilometers with one decimal from 1000 m", () => {
    expect(formatDistance(1000)).toBe("1.0 km");
    expect(formatDistance(1249)).toBe("1.2 km");
    expect(formatDistance(12_345)).toBe("12.3 km");
  });

  it("does not show '1000 m' when rounding reaches one kilometer", () => {
    expect(formatDistance(996)).toBe("1.0 km");
  });
});
