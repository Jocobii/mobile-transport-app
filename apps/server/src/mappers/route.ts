import type { Route } from "@transit/core";
import type { RouteSummaryDto } from "@transit/contracts";

export function mapRoute(route: Route): RouteSummaryDto {
  return {
    id: route.id,
    feedId: route.feedId,
    shortName: route.shortName,
    longName: route.longName,
    color: route.color,
    textColor: route.textColor,
  };
}

/** `routeShortName` in DTOs falls back to `longName` when `shortName` is empty. */
export function routeShortName(route: Route): string {
  return route.shortName || route.longName;
}
