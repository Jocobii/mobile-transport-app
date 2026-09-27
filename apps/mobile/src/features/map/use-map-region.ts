import type { VehicleDto } from "@transit/contracts";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { Region } from "react-native-maps";
import { regionStore } from "./region-store";
import type { VehicleLabelDetail } from "./vehicle-label";
import { type MapSize, placeVehicleLabels, sameLabelDetails } from "./vehicle-label-placement";
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

/**
 * How much each vehicle's label shows (`placeVehicleLabels`), recomputed when the map settles or
 * the vehicles change. Returns the same Map while nothing changed, so a pan that moves no label
 * re-renders nothing.
 */
export function useVehicleLabelDetails(
  vehicles: readonly VehicleDto[],
  size: MapSize | undefined,
): ReadonlyMap<string, VehicleLabelDetail> {
  const [details, setDetails] = useState(() =>
    placeVehicleLabels(vehicles, regionStore.get(), size, Date.now() / 1000),
  );

  useEffect(() => {
    const update = () => {
      const next = placeVehicleLabels(vehicles, regionStore.get(), size, Date.now() / 1000);
      setDetails((previous) => (sameLabelDetails(previous, next) ? previous : next));
    };
    update();
    return regionStore.subscribe(update);
  }, [vehicles, size]);

  return details;
}
