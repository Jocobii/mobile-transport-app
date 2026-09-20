import {
  DEFAULT_ROUTE_FILTER,
  type FilterRoute,
  MAX_FILTER_ROUTES,
  type RouteFilter,
} from "./route-filter";

/** Storage key for the persisted route filter (E007-T02). */
export const ROUTE_FILTER_STORAGE_KEY = "route-filter";

function parseStoredRoute(value: unknown): FilterRoute | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || record.id === "") return undefined;
  if (typeof record.shortName !== "string") return undefined;
  return {
    id: record.id,
    shortName: record.shortName,
    color: typeof record.color === "string" ? record.color : undefined,
    textColor: typeof record.textColor === "string" ? record.textColor : undefined,
  };
}

/**
 * Parses a stored route filter. Missing or malformed data gives the defaults; a partial value keeps
 * what is valid per field: malformed routes and repeated ids are dropped, the list is cut to the
 * maximum, and `enabled` is only kept when at least one route remains.
 */
export function parseStoredRouteFilter(raw: string | null): RouteFilter {
  if (raw === null) return DEFAULT_ROUTE_FILTER;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_ROUTE_FILTER;
  }
  if (typeof parsed !== "object" || parsed === null) return DEFAULT_ROUTE_FILTER;
  const record = parsed as Record<string, unknown>;

  const seen = new Set<string>();
  const routes: FilterRoute[] = [];
  if (Array.isArray(record.routes)) {
    for (const item of record.routes) {
      const route = parseStoredRoute(item);
      if (!route || seen.has(route.id)) continue;
      seen.add(route.id);
      routes.push(route);
      if (routes.length === MAX_FILTER_ROUTES) break;
    }
  }

  return { enabled: record.enabled === true && routes.length > 0, routes };
}
