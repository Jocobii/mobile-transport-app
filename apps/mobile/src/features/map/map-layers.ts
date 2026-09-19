/** What the Nearby/Search map layers show. Both default to on. */
export interface MapLayers {
  showVehicles: boolean;
  showStops: boolean;
}

export const DEFAULT_MAP_LAYERS: MapLayers = {
  showVehicles: true,
  showStops: true,
};
