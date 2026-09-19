import type { RouteSummaryDto } from "@transit/contracts";

/** A route the user chose to keep on the map. Stores what a badge needs so it renders offline. */
export interface FilterRoute {
  id: string;
  shortName: string;
  /** `#RRGGBB`, uppercase, or undefined. */
  color?: string | undefined;
  /** `#RRGGBB`, uppercase, or undefined. */
  textColor?: string | undefined;
}

/** The "only my buses" filter: a list of routes plus a switch. */
export interface RouteFilter {
  enabled: boolean;
  routes: FilterRoute[];
}

/** Mirrors the server's `routeFilterMaxRoutes` setting (a longer list is rejected with a 400). */
export const MAX_FILTER_ROUTES = 8;

export const DEFAULT_ROUTE_FILTER: RouteFilter = { enabled: false, routes: [] };

export function toFilterRoute(route: RouteSummaryDto): FilterRoute {
  return {
    id: route.id,
    shortName: route.shortName,
    color: route.color,
    textColor: route.textColor,
  };
}

export function isRouteSelected(filter: RouteFilter, routeId: string): boolean {
  return filter.routes.some((route) => route.id === routeId);
}

export function isFilterFull(filter: RouteFilter): boolean {
  return filter.routes.length >= MAX_FILTER_ROUTES;
}

/**
 * Removes a route. Removing the last route turns the filter off, so an enabled filter always has
 * at least one route.
 */
export function removeRoute(filter: RouteFilter, routeId: string): RouteFilter {
  if (!isRouteSelected(filter, routeId)) return filter;
  const routes = filter.routes.filter((route) => route.id !== routeId);
  return { enabled: routes.length > 0 && filter.enabled, routes };
}

/**
 * Adds the route when it is not selected, removes it when it is. Adding is ignored once the list is
 * full. Adding the first route turns the filter on; later additions keep the switch as it is.
 */
export function toggleRoute(filter: RouteFilter, route: FilterRoute): RouteFilter {
  if (isRouteSelected(filter, route.id)) return removeRoute(filter, route.id);
  if (isFilterFull(filter)) return filter;
  return {
    enabled: filter.routes.length === 0 ? true : filter.enabled,
    routes: [...filter.routes, route],
  };
}

/** Turns the filter on or off. It cannot be turned on while the list is empty. */
export function setFilterEnabled(filter: RouteFilter, enabled: boolean): RouteFilter {
  const next = enabled && filter.routes.length > 0;
  return next === filter.enabled ? filter : { ...filter, enabled: next };
}

/** Route ids to filter by, or undefined when the filter is off (or empty). */
export function activeRouteIds(filter: RouteFilter): string[] | undefined {
  if (!filter.enabled || filter.routes.length === 0) return undefined;
  return filter.routes.map((route) => route.id);
}
