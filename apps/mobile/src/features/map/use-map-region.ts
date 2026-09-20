import { useEffect, useState, useSyncExternalStore } from "react";
import type { Region } from "react-native-maps";
import { regionStore } from "./region-store";
import { isWithinZoomGate } from "./viewport";

/** The map region once it has stayed unchanged for `delayMs` (drives the area fetches). */
export function useDebouncedRegion(delayMs: number): Region | undefined {
  const [debounced, setDebounced] = useState<Region | undefined>(regionStore.get);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = regionStore.subscribe(() => {
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => setDebounced(regionStore.get()), delayMs);
    });
    return () => {
      unsubscribe();
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [delayMs]);

  return debounced;
}

/**
 * True while `active` and the map is zoomed out past the gate. Re-renders only when that flips,
 * not on every pan.
 */
export function useZoomedOutPastGate(active: boolean, maxDelta: number): boolean {
  return useSyncExternalStore(regionStore.subscribe, () => {
    const region = regionStore.get();
    return active && region !== undefined && !isWithinZoomGate(region, maxDelta);
  });
}
