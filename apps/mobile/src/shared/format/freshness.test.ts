import { describe, expect, it } from "vitest";
import { VEHICLE_POSITION_WARN_AFTER_SECONDS } from "@/shared/config";
import {
  formatFreshness,
  isPositionOutdated,
  outdatedPositionMinutes,
  secondsSince,
} from "./freshness";

describe("secondsSince", () => {
  it("returns whole elapsed seconds", () => {
    expect(secondsSince(1000, 1042)).toBe(42);
  });

  it("never returns a negative value when the clock is behind the timestamp", () => {
    expect(secondsSince(1000, 990)).toBe(0);
  });
});

describe("formatFreshness", () => {
  it("uses seconds under one minute", () => {
    expect(formatFreshness(59)).toEqual({ key: "freshness.seconds", params: { seconds: 59 } });
  });

  it("uses whole minutes from one minute on", () => {
    expect(formatFreshness(60)).toEqual({ key: "freshness.minutes", params: { minutes: 1 } });
    expect(formatFreshness(185).params).toEqual({ minutes: 3 });
  });

  it("uses the inline keys for the inline variant", () => {
    expect(formatFreshness(5, "inline").key).toBe("freshness.inlineSeconds");
    expect(formatFreshness(120, "inline").key).toBe("freshness.inlineMinutes");
  });
});

describe("isPositionOutdated", () => {
  const limit = VEHICLE_POSITION_WARN_AFTER_SECONDS;

  it("is false up to the warning threshold", () => {
    expect(isPositionOutdated(limit)).toBe(false);
  });

  it("is true past the warning threshold", () => {
    expect(isPositionOutdated(limit + 1)).toBe(true);
  });
});

describe("outdatedPositionMinutes", () => {
  const limit = VEHICLE_POSITION_WARN_AFTER_SECONDS;

  it("is undefined while the position is fresh", () => {
    expect(outdatedPositionMinutes(limit)).toBeUndefined();
  });

  it("shows at least 1 minute as soon as the position is outdated", () => {
    expect(outdatedPositionMinutes(limit + 1)).toBeGreaterThanOrEqual(1);
  });

  it("counts whole minutes", () => {
    expect(outdatedPositionMinutes(179)).toBe(2);
    expect(outdatedPositionMinutes(180)).toBe(3);
  });
});
