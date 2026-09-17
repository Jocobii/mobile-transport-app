import { describe, expect, it } from "vitest";
import type { Clock } from "@transit/core";
import { createInMemoryCache } from "./in-memory-cache";

function fakeClock(start: number): Clock & { advance: (seconds: number) => void } {
  let now = start;
  return {
    now: () => now,
    advance: (seconds: number) => {
      now += seconds;
    },
  };
}

describe("createInMemoryCache", () => {
  it("returns undefined for a key that was never set", async () => {
    const cache = createInMemoryCache(fakeClock(1000));
    expect(await cache.get("missing")).toBeUndefined();
  });

  it("returns the stored value within the TTL", async () => {
    const clock = fakeClock(1000);
    const cache = createInMemoryCache(clock);
    await cache.set("key", { a: 1 }, 20);
    clock.advance(19);
    expect(await cache.get("key")).toEqual({ a: 1 });
  });

  it("expires the value once the TTL has elapsed", async () => {
    const clock = fakeClock(1000);
    const cache = createInMemoryCache(clock);
    await cache.set("key", "value", 20);
    clock.advance(20);
    expect(await cache.get("key")).toBeUndefined();
  });

  it("overwrites a key with a new value and TTL", async () => {
    const clock = fakeClock(1000);
    const cache = createInMemoryCache(clock);
    await cache.set("key", "first", 5);
    await cache.set("key", "second", 20);
    clock.advance(10);
    expect(await cache.get("key")).toBe("second");
  });
});
