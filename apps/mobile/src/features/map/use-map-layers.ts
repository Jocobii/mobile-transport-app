import { useCallback, useEffect, useRef, useState } from "react";
import { readStored, writeStored } from "@/shared/storage/storage";
import type { MapLayers } from "./map-layers";
import { MAP_LAYERS_STORAGE_KEY, parseStoredLayers } from "./map-layers-storage";

export interface UseMapLayersResult {
  layers: MapLayers;
  setShowVehicles: (value: boolean) => void;
  setShowStops: (value: boolean) => void;
}

/**
 * Map layer toggles (live buses, stops). Read synchronously from storage for the first render, so
 * the map never mounts with defaults and remounts once the saved choice arrives. Saved on every
 * change, so the choice survives an app restart.
 */
export function useMapLayers(): UseMapLayersResult {
  const [layers, setLayers] = useState<MapLayers>(() =>
    parseStoredLayers(readStored(MAP_LAYERS_STORAGE_KEY) ?? null),
  );
  const skipNextSave = useRef(true);

  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    writeStored(MAP_LAYERS_STORAGE_KEY, JSON.stringify(layers));
  }, [layers]);

  const setShowVehicles = useCallback(
    (value: boolean) => setLayers((current) => ({ ...current, showVehicles: value })),
    [],
  );
  const setShowStops = useCallback(
    (value: boolean) => setLayers((current) => ({ ...current, showStops: value })),
    [],
  );

  return { layers, setShowVehicles, setShowStops };
}
