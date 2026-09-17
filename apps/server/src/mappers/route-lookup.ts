import type { Route, RouteId } from "@transit/core";

/**
 * Looks up a route by id among the routes already fetched for the context it came
 * from (e.g. the routes serving a stop). Throws if the route is missing: an arrival
 * or vehicle whose route isn't in that set would mean the catalog or TransitService
 * broke an invariant, which the caller should surface as a 500, not hide.
 */
export function requireRoute(routesById: ReadonlyMap<RouteId, Route>, routeId: RouteId): Route {
  const route = routesById.get(routeId);
  if (!route) {
    throw new Error(`Route ${routeId} was not among the routes provided for this response.`);
  }
  return route;
}

export function routesById(routes: readonly Route[]): Map<RouteId, Route> {
  return new Map(routes.map((route) => [route.id, route]));
}
