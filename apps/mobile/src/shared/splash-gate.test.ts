import { describe, expect, it, vi } from "vitest";
import { brandSplashDismissDelay, createSplashGate } from "./splash-gate";

describe("createSplashGate", () => {
  it("starts not ready", () => {
    expect(createSplashGate().isReady()).toBe(false);
  });

  it("notifies subscribers once when marked ready", () => {
    const gate = createSplashGate();
    const listener = vi.fn();
    gate.subscribe(listener);

    gate.markReady();
    gate.markReady();

    expect(gate.isReady()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("stops notifying after unsubscribe", () => {
    const gate = createSplashGate();
    const listener = vi.fn();
    const unsubscribe = gate.subscribe(listener);

    unsubscribe();
    gate.markReady();

    expect(listener).not.toHaveBeenCalled();
  });
});

describe("brandSplashDismissDelay", () => {
  it("waits for the rest of the minimum time", () => {
    expect(brandSplashDismissDelay(400, 1600)).toBe(1200);
  });

  it("does not wait once the minimum time has passed", () => {
    expect(brandSplashDismissDelay(2500, 1600)).toBe(0);
  });
});
