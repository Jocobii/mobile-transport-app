import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readStored, writeStored } from "@/shared/storage/storage";
import {
  activeRouteIds,
  type FilterRoute,
  type RouteFilter,
  removeRoute as removeRouteFrom,
  setFilterEnabled,
  toggleRoute as toggleRouteIn,
} from "./route-filter";
import { parseStoredRouteFilter, ROUTE_FILTER_STORAGE_KEY } from "./route-filter-storage";

export interface UseRouteFilterResult {
  filter: RouteFilter;
  /** Route ids to filter by; undefined while the filter is off. Stable while unchanged. */
  routeIds: string[] | undefined;
  toggleRoute: (route: FilterRoute) => void;
  removeRoute: (routeId: string) => void;
  setEnabled: (enabled: boolean) => void;
}

/**
 * The "only my buses" route filter. Read synchronously from storage for the first render (no
 * default-then-restored flip, so no second fetch with a different filter) and saved on every
 * change, so it survives an app restart.
 */
export function useRouteFilter(): UseRouteFilterResult {
  const [filter, setFilter] = useState<RouteFilter>(() =>
    parseStoredRouteFilter(readStored(ROUTE_FILTER_STORAGE_KEY) ?? null),
  );
  const skipNextSave = useRef(true);

  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    writeStored(ROUTE_FILTER_STORAGE_KEY, JSON.stringify(filter));
  }, [filter]);

  const toggleRoute = useCallback(
    (route: FilterRoute) => setFilter((current) => toggleRouteIn(current, route)),
    [],
  );
  const removeRoute = useCallback(
    (routeId: string) => setFilter((current) => removeRouteFrom(current, routeId)),
    [],
  );
  const setEnabled = useCallback(
    (enabled: boolean) => setFilter((current) => setFilterEnabled(current, enabled)),
    [],
  );

  const routeIds = useMemo(() => activeRouteIds(filter), [filter]);

  return { filter, routeIds, toggleRoute, removeRoute, setEnabled };
}
