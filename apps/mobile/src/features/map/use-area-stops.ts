import type { StopSummaryDto } from "@transit/contracts";
import { useEffect, useRef, useState } from "react";
import type { Region } from "react-native-maps";
import { apiClient } from "@/api/client";
import { AREA_EXPAND_FACTOR, AREA_SNAP_GRID_DEGREES, STOPS_ZOOM_GATE_DELTA } from "./map-config";
import {
  containsBounds,
  expandBounds,
  isWithinZoomGate,
  regionToBounds,
  snapBoundsOutward,
  type ViewportBounds,
} from "./viewport";

export interface AreaStopsResult {
  stops: StopSummaryDto[];
  truncated: boolean;
}

/**
 * Stops inside the visible map area (catalog data: fetched once per area, not polled).
 * `undefined` while disabled, outside the stops zoom gate, or before the first fetch resolves.
 */
export function useAreaStops(
  region: Region | undefined,
  enabled: boolean,
): AreaStopsResult | undefined {
  const [result, setResult] = useState<AreaStopsResult | undefined>(undefined);
  const fetchedBounds = useRef<ViewportBounds | undefined>(undefined);
  const active = enabled && region !== undefined && isWithinZoomGate(region, STOPS_ZOOM_GATE_DELTA);

  useEffect(() => {
    if (!active) {
      fetchedBounds.current = undefined;
      setResult(undefined);
      return;
    }
    if (!region) return;

    const visible = regionToBounds(region);
    if (fetchedBounds.current && containsBounds(fetchedBounds.current, visible)) return;

    const fetchArea = snapBoundsOutward(
      expandBounds(visible, AREA_EXPAND_FACTOR),
      AREA_SNAP_GRID_DEGREES,
    );
    let cancelled = false;
    apiClient
      .getStopsInArea(fetchArea)
      .then((response) => {
        if (cancelled) return;
        fetchedBounds.current = fetchArea;
        setResult(response);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [active, region]);

  return active ? result : undefined;
}
