import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  activeRouteIds,
  DEFAULT_ROUTE_FILTER,
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
 * The "only my buses" route filter. Loaded once from `AsyncStorage` on mount and saved on every
 * change, so it survives an app restart. Storage calls never throw: a failed load keeps the
 * defaults and a failed save is silently dropped.
 */
export function useRouteFilter(): UseRouteFilterResult {
  const [filter, setFilter] = useState<RouteFilter>(DEFAULT_ROUTE_FILTER);
  const skipNextSave = useRef(true);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(ROUTE_FILTER_STORAGE_KEY)
      .then((raw) => {
        if (!cancelled) setFilter(parseStoredRouteFilter(raw));
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
    AsyncStorage.setItem(ROUTE_FILTER_STORAGE_KEY, JSON.stringify(filter)).catch(() => undefined);
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
