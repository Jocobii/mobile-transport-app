import type { StopSummaryDto } from "@transit/contracts";
import { useEffect, useRef, useState } from "react";
import type { Region } from "react-native-maps";
import { apiClient } from "@/api/client";
import { canReuseFetchedArea, type FetchedArea, routeFilterKey } from "./area-fetch";
import { AREA_EXPAND_FACTOR, AREA_SNAP_GRID_DEGREES, STOPS_ZOOM_GATE_DELTA } from "./map-config";
import { expandBounds, isWithinZoomGate, regionToBounds, snapBoundsOutward } from "./viewport";

export interface AreaStopsResult {
  stops: StopSummaryDto[];
  truncated: boolean;
}

interface StoredResult {
  routeKey: string;
  data: AreaStopsResult;
}

/**
 * Stops inside the visible map area (catalog data: fetched once per area, not polled). With
 * `routeIds` (the route filter is on) only stops served by those routes. A change of the filter
 * refetches even inside the same area, and a result fetched for another filter is never returned.
 * `undefined` while disabled, outside the stops zoom gate, or before the first fetch resolves.
 */
export function useAreaStops(
  region: Region | undefined,
  enabled: boolean,
  routeIds: string[] | undefined,
): AreaStopsResult | undefined {
  const [result, setResult] = useState<StoredResult | undefined>(undefined);
  const fetched = useRef<FetchedArea | undefined>(undefined);
  const active = enabled && region !== undefined && isWithinZoomGate(region, STOPS_ZOOM_GATE_DELTA);
  const routeKey = routeFilterKey(routeIds);

  useEffect(() => {
    if (!active) {
      fetched.current = undefined;
      setResult(undefined);
      return;
    }
    if (!region) return;

    const visible = regionToBounds(region);
    if (canReuseFetchedArea(fetched.current, visible, routeKey)) return;

    const fetchArea = snapBoundsOutward(
      expandBounds(visible, AREA_EXPAND_FACTOR),
      AREA_SNAP_GRID_DEGREES,
    );
    let cancelled = false;
    apiClient
      .getStopsInArea(fetchArea, { routeIds })
      .then((response) => {
        if (cancelled) return;
        fetched.current = { bounds: fetchArea, routeKey };
        setResult({ routeKey, data: response });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [active, region, routeKey, routeIds]);

  return active && result?.routeKey === routeKey ? result.data : undefined;
}
