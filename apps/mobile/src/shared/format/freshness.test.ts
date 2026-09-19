import { describe, expect, it } from "vitest";
import { formatFreshness, secondsSince } from "./freshness";

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
