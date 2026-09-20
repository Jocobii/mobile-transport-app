import { describe, expect, it } from "vitest";
import { createLruCache } from "./lru-cache";

describe("createLruCache", () => {
  it("returns stored values and undefined for unknown keys", () => {
    const cache = createLruCache<string, number>(2);
    cache.set("a", 1);
    expect(cache.get("a")).toBe(1);
    expect(cache.get("b")).toBeUndefined();
  });

  it("evicts the least recently used entry when full", () => {
    const cache = createLruCache<string, number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBe(3);
    expect(cache.size).toBe(2);
  });

  it("counts a read as use", () => {
    const cache = createLruCache<string, number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.get("a");
    cache.set("c", 3);
    expect(cache.get("a")).toBe(1);
    expect(cache.get("b")).toBeUndefined();
  });

  it("replaces the value of an existing key without growing", () => {
    const cache = createLruCache<string, number>(2);
    cache.set("a", 1);
    cache.set("a", 9);
    expect(cache.get("a")).toBe(9);
    expect(cache.size).toBe(1);
  });
});
