import type { Region } from "react-native-maps";
import { describe, expect, it } from "vitest";
import { createRegionStore } from "./region-store";

const REGION: Region = {
  latitude: 44.98,
  longitude: -93.27,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

describe("createRegionStore", () => {
  it("starts empty and returns the last region set", () => {
    const store = createRegionStore();
    expect(store.get()).toBeUndefined();
    store.set(REGION);
    expect(store.get()).toBe(REGION);
  });

  it("notifies subscribers after each set, with the new region already readable", () => {
    const store = createRegionStore();
    const seen: Array<Region | undefined> = [];
    store.subscribe(() => seen.push(store.get()));
    store.set(REGION);
    const moved = { ...REGION, latitude: 45 };
    store.set(moved);
    expect(seen).toEqual([REGION, moved]);
  });

  it("stops notifying a subscriber that unsubscribed", () => {
    const store = createRegionStore();
    let calls = 0;
    const off = store.subscribe(() => {
      calls += 1;
    });
    off();
    store.set(REGION);
    expect(calls).toBe(0);
  });
});
