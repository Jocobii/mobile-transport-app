import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_MAP_LAYERS, type MapLayers } from "./map-layers";
import { MAP_LAYERS_STORAGE_KEY, parseStoredLayers } from "./map-layers-storage";

export interface UseMapLayersResult {
  layers: MapLayers;
  setShowVehicles: (value: boolean) => void;
  setShowStops: (value: boolean) => void;
}

/**
 * Map layer toggles (live buses, stops). Loaded once from `AsyncStorage` on mount and saved on
 * every change, so the choice survives an app restart. Storage calls never throw: a failed load
 * keeps the defaults, and a failed save is silently dropped.
 */
export function useMapLayers(): UseMapLayersResult {
  const [layers, setLayers] = useState<MapLayers>(DEFAULT_MAP_LAYERS);
  const skipNextSave = useRef(true);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(MAP_LAYERS_STORAGE_KEY)
      .then((raw) => {
        if (!cancelled) setLayers(parseStoredLayers(raw));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    AsyncStorage.setItem(MAP_LAYERS_STORAGE_KEY, JSON.stringify(layers)).catch(() => undefined);
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
