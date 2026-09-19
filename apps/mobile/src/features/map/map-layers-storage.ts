import { DEFAULT_MAP_LAYERS, type MapLayers } from "./map-layers";

/** AsyncStorage key for the persisted layer toggles (E005-T06). */
export const MAP_LAYERS_STORAGE_KEY = "map-layers";

/**
 * Parses a stored map-layers value. Returns the defaults for missing (`null`), malformed
 * (invalid JSON, not an object), or partial data (a field missing or of the wrong type falls
 * back to its own default rather than discarding the whole value).
 */
export function parseStoredLayers(raw: string | null): MapLayers {
  if (raw === null) return DEFAULT_MAP_LAYERS;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_MAP_LAYERS;
  }

  if (typeof parsed !== "object" || parsed === null) return DEFAULT_MAP_LAYERS;
  const record = parsed as Record<string, unknown>;

  return {
    showVehicles:
      typeof record.showVehicles === "boolean"
        ? record.showVehicles
        : DEFAULT_MAP_LAYERS.showVehicles,
    showStops:
      typeof record.showStops === "boolean" ? record.showStops : DEFAULT_MAP_LAYERS.showStops,
  };
}
