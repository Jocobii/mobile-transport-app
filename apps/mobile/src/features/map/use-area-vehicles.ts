import type { VehicleDto } from "@transit/contracts";
import { useEffect, useState } from "react";
import type { Region } from "react-native-maps";
import { apiClient } from "@/api/client";
import { usePolledQuery } from "@/shared/polling/use-polled-query";
import { AREA_EXPAND_FACTOR, AREA_SNAP_GRID_DEGREES, VEHICLES_ZOOM_GATE_DELTA } from "./map-config";
import {
  containsBounds,
  expandBounds,
  isWithinZoomGate,
  regionToBounds,
  snapBoundsOutward,
  type ViewportBounds,
} from "./viewport";

export interface AreaVehiclesResult {
  vehicles: VehicleDto[];
  truncated: boolean;
}

function boundsKey(bounds: ViewportBounds): string {
  return `${bounds.minLat},${bounds.minLon},${bounds.maxLat},${bounds.maxLon}`;
}

/**
 * Live vehicles inside the visible map area, polled every 20 s while active (see
 * `REFRESH_INTERVAL_MS`). `undefined` while disabled, outside the vehicles zoom gate, or before
 * the first fetch resolves. The fetch area only grows when the region pans outside it (as in
 * `useAreaStops`); polling then keeps refreshing that same area.
 */
export function useAreaVehicles(
  region: Region | undefined,
  enabled: boolean,
): AreaVehiclesResult | undefined {
  const [fetchArea, setFetchArea] = useState<ViewportBounds | undefined>(undefined);
  const active =
    enabled && region !== undefined && isWithinZoomGate(region, VEHICLES_ZOOM_GATE_DELTA);

  useEffect(() => {
    if (!active || !region) {
      setFetchArea(undefined);
      return;
    }
    const visible = regionToBounds(region);
    setFetchArea((current) => {
      if (current && containsBounds(current, visible)) return current;
      return snapBoundsOutward(expandBounds(visible, AREA_EXPAND_FACTOR), AREA_SNAP_GRID_DEGREES);
    });
  }, [active, region]);

  const query = usePolledQuery(
    fetchArea ? `area-vehicles:${boundsKey(fetchArea)}` : "area-vehicles:idle",
    () => {
      if (!fetchArea) return Promise.reject(new Error("No fetch area"));
      return apiClient.getVehiclesInArea(fetchArea);
    },
    { enabled: active && fetchArea !== undefined },
  );

  return active ? query.data : undefined;
}
