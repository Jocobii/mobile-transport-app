/** Pure helpers for the empty-stop state (no React Native import, so Vitest can load them). */
import type { StopTimetableResponse, TimetableGroupDto } from "@transit/contracts";
import { findNextDeparture } from "@/shared/format/timetable";

export interface RouteBadgeInfo {
  routeId: string;
  routeShortName: string;
  routeColor?: string | undefined;
  routeTextColor?: string | undefined;
}

export interface NextDeparture {
  /** Epoch seconds. */
  time: number;
  /** `YYYYMMDD` of the timetable that has the departure. */
  serviceDate: string;
  /** `today` of that response (feed time zone), to label the day. */
  feedToday: string;
  /** The departure belongs to today's timetable. */
  today: boolean;
  route: RouteBadgeInfo;
}

function toBadge(group: TimetableGroupDto): RouteBadgeInfo {
  return {
    routeId: group.routeId,
    routeShortName: group.routeShortName,
    routeColor: group.routeColor,
    routeTextColor: group.routeTextColor,
  };
}

/** Unique routes of a timetable, by `routeId`, in the order the server delivered them. */
export function routesOf(response: Pick<StopTimetableResponse, "groups">): RouteBadgeInfo[] {
  const seen = new Set<string>();
  const routes: RouteBadgeInfo[] = [];
  for (const group of response.groups) {
    if (seen.has(group.routeId)) continue;
    seen.add(group.routeId);
    routes.push(toBadge(group));
  }
  return routes;
}

/**
 * The earliest departure at or after `now` in the first response that has one (responses are in
 * date order: today first). Departures before `now` are ignored.
 */
export function pickNextDeparture(
  responses: readonly StopTimetableResponse[],
  now: number,
): NextDeparture | undefined {
  for (const response of responses) {
    let best: { time: number; group: TimetableGroupDto } | undefined;
    for (const group of response.groups) {
      const time = findNextDeparture(group.times, now);
      if (time !== undefined && (best === undefined || time < best.time)) best = { time, group };
    }
    if (best) {
      return {
        time: best.time,
        serviceDate: response.serviceDate,
        feedToday: response.today,
        today: response.serviceDate === response.today,
        route: toBadge(best.group),
      };
    }
  }
  return undefined;
}

export interface EmptyStopSummary {
  next: NextDeparture | undefined;
  /** Routes of the day that has the next departure; today's routes when there is none. */
  routes: RouteBadgeInfo[];
}

/** Everything the empty-stop panel shows, from the (at most two) timetables fetched. */
export function summarizeEmptyStop(
  responses: readonly StopTimetableResponse[],
  now: number,
): EmptyStopSummary {
  const next = pickNextDeparture(responses, now);
  const source = next ? responses.find((r) => r.serviceDate === next.serviceDate) : responses[0];
  return { next, routes: source ? routesOf(source) : [] };
}

/** The first available date after `serviceDate`, or `undefined` at the end of the catalog. */
export function dateAfter(response: StopTimetableResponse): string | undefined {
  return response.availableDates.find((date) => date > response.serviceDate);
}
