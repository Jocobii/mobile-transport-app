import { containsBounds, type ViewportBounds } from "./viewport";

/** An area whose stops were already fetched, and for which route filter (`""` = no filter). */
export interface FetchedArea {
  bounds: ViewportBounds;
  routeKey: string;
}

/** Stable key for the route filter of an area request; `""` when there is no filter. */
export function routeFilterKey(routeIds: string[] | undefined): string {
  return routeIds?.join(",") ?? "";
}

/**
 * Whether the stops already fetched still cover what is visible: the visible area must lie inside
 * the fetched one and the route filter must be the same (a different filter needs new data).
 */
export function canReuseFetchedArea(
  fetched: FetchedArea | undefined,
  visible: ViewportBounds,
  routeKey: string,
): boolean {
  return (
    fetched !== undefined &&
    fetched.routeKey === routeKey &&
    containsBounds(fetched.bounds, visible)
  );
}
