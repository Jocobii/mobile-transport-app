import { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import type { Position } from "@/shared/geo/position";

interface ShapeState {
  key: string;
  shape: Position[];
}

/** Route shape of one direction, fetched once; `undefined` until loaded or when it fails. */
export function useRouteShape(
  routeId: string | undefined,
  directionId: 0 | 1 | undefined,
): Position[] | undefined {
  const [state, setState] = useState<ShapeState | undefined>(undefined);
  const key = routeId !== undefined && directionId !== undefined ? `${routeId}:${directionId}` : "";

  useEffect(() => {
    if (routeId === undefined || directionId === undefined) return;
    let cancelled = false;
    apiClient
      .getRouteDetail(routeId, { directionId })
      .then((detail) => {
        if (!cancelled) setState({ key: `${routeId}:${directionId}`, shape: detail.shape });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [routeId, directionId]);

  return state !== undefined && state.key === key ? state.shape : undefined;
}
