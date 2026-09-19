import type { DirectionId, EpochSeconds, Route, ScheduledStopTime } from "../model";
import { compareNaturally, compareRoutesNaturally } from "./natural-order";

/** Scheduled departures of one route + direction + headsign at a stop, for one service date. */
export interface TimetableGroup {
  route: Route;
  directionId: DirectionId;
  headsign: string;
  /** Ascending and unique. */
  times: EpochSeconds[];
}

/**
 * Groups a stop's scheduled departures like the Nearby list does: one group per
 * (route, direction, headsign). Groups are ordered by route (natural order), then direction,
 * then headsign. Identical times inside a group are collapsed (two trips at the same minute
 * add nothing for a rider). Entries whose route is not in `routes` cannot be labeled and are dropped.
 */
export function groupTimetable(stopTimes: ScheduledStopTime[], routes: Route[]): TimetableGroup[] {
  const routesById = new Map(routes.map((route) => [route.id, route]));
  const groups = new Map<string, TimetableGroup>();

  for (const stopTime of stopTimes) {
    const route = routesById.get(stopTime.routeId);
    if (!route) continue;

    const key = `${stopTime.routeId}|${stopTime.directionId}|${stopTime.headsign}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        route,
        directionId: stopTime.directionId,
        headsign: stopTime.headsign,
        times: [],
      };
      groups.set(key, group);
    }
    group.times.push(stopTime.time);
  }

  for (const group of groups.values()) {
    group.times = [...new Set(group.times)].sort((a, b) => a - b);
  }

  return [...groups.values()].sort(
    (a, b) =>
      compareRoutesNaturally(a.route.id, b.route.id) ||
      a.directionId - b.directionId ||
      compareNaturally(a.headsign, b.headsign),
  );
}
