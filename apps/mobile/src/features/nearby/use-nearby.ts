import { useEffect, useRef } from "react";
import { apiClient } from "@/api/client";
import type { Position } from "@/shared/geo/position";
import { usePolledQuery } from "@/shared/polling/use-polled-query";

/**
 * Nearby stops for the last known user position (server default radius).
 * Panning the map does not re-query; a new position (recenter) triggers one refetch.
 */
export function useNearby(position: Position | undefined, enabled: boolean) {
  const query = usePolledQuery(
    "nearby",
    () => {
      if (!position) return Promise.reject(new Error("User position is not available"));
      return apiClient.getNearbyStops({ lat: position.lat, lon: position.lon });
    },
    { enabled: enabled && position !== undefined },
  );

  const previousPosition = useRef(position);
  const { refetch } = query;
  useEffect(() => {
    if (previousPosition.current && previousPosition.current !== position) refetch();
    previousPosition.current = position;
  }, [position, refetch]);

  return query;
}
