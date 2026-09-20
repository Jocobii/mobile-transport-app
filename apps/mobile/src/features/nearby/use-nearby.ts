import { useEffect, useRef } from "react";
import { apiClient } from "@/api/client";
import { hasMovedAtLeast, type Position } from "@/shared/geo/position";
import { usePolledQuery } from "@/shared/polling/use-polled-query";

/** A new position closer than this to the one already queried does not trigger a refetch. */
const REFETCH_MOVE_METERS = 50;

/**
 * Nearby stops for the last known user position (server default radius). With `routeIds` (the
 * route filter is on) the server only considers stops served by those routes.
 * Panning the map does not re-query; a new position more than `REFETCH_MOVE_METERS` from the
 * previous one (recenter, or the first GPS fix after a saved position) triggers one refetch, and
 * so does a change of the filtered routes (a different query key). The last response is kept on
 * disk, so the next start shows it at once while the fresh one loads.
 */
export function useNearby(
  position: Position | undefined,
  enabled: boolean,
  routeIds: string[] | undefined,
) {
  const query = usePolledQuery(
    `nearby:${routeIds?.join(",") ?? ""}`,
    () => {
      if (!position) return Promise.reject(new Error("User position is not available"));
      return apiClient.getNearbyStops({ lat: position.lat, lon: position.lon, routeIds });
    },
    { enabled: enabled && position !== undefined, persist: true },
  );

  const previousPosition = useRef(position);
  const { refetch } = query;
  useEffect(() => {
    const previous = previousPosition.current;
    if (previous && position && hasMovedAtLeast(previous, position, REFETCH_MOVE_METERS)) refetch();
    previousPosition.current = position;
  }, [position, refetch]);

  return query;
}
