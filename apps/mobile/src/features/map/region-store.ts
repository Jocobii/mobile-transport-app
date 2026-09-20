import type { Region } from "react-native-maps";

export interface RegionStore {
  get(): Region | undefined;
  set(region: Region): void;
  /** Calls `listener` after every `set`; returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
}

/**
 * Where the map is looking. It lives outside React state so a pan or zoom does not re-render the
 * whole screen: only the hooks that read a derived value (debounced area, zoom gate) re-render,
 * and only when that value changes.
 */
export function createRegionStore(): RegionStore {
  let current: Region | undefined;
  const listeners = new Set<() => void>();

  return {
    get: () => current,
    set(region) {
      current = region;
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const regionStore = createRegionStore();
