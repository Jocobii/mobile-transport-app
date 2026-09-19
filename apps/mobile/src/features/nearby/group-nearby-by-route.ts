import type {
  ArrivalDto,
  NearbyStopDto,
  NearbyStopsResponse,
  StopSummaryDto,
} from "@transit/contracts";

/** One Nearby row: a route + destination, with the closest stop where it can be boarded. */
export interface NearbyRouteGroup {
  /** Stable id: `${routeId}|${headsign}`. */
  key: string;
  routeId: string;
  routeShortName: string;
  routeColor?: string | undefined;
  routeTextColor?: string | undefined;
  directionId: 0 | 1;
  headsign: string;
  /** Boarding stop: the nearest stop with an arrival for this group. */
  stop: StopSummaryDto;
  distanceMeters: number;
  /** Ordered arrivals to show: the first one (any status) plus the next normal ones, max two. */
  arrivals: ArrivalDto[];
}

interface Candidate {
  item: NearbyStopDto;
  arrivals: ArrivalDto[];
}

function groupKey(arrival: ArrivalDto): string {
  return `${arrival.routeId}|${arrival.headsign}`;
}

/** Two arrivals to show: canceled/skipped only appears when it is the first one. */
function pickShownArrivals(sorted: ArrivalDto[]): ArrivalDto[] {
  const [first] = sorted;
  if (!first) return [];
  const normals = sorted.filter((arrival) => arrival.status === "normal");
  if (first.status === "normal") return normals.slice(0, 2);
  return [first, ...normals.slice(0, 1)];
}

/**
 * Groups nearby arrivals by (routeId, headsign) across all stops. The boarding stop of a group is
 * the nearest stop that has an arrival for it. Rows are ordered by their first arrival time.
 */
export function groupNearbyByRoute(response: NearbyStopsResponse): NearbyRouteGroup[] {
  const nearest = new Map<string, Candidate>();

  for (const item of response.stops) {
    const byKey = new Map<string, ArrivalDto[]>();
    for (const arrival of item.nextArrivals) {
      const key = groupKey(arrival);
      const list = byKey.get(key);
      if (list) list.push(arrival);
      else byKey.set(key, [arrival]);
    }
    for (const [key, arrivals] of byKey) {
      const current = nearest.get(key);
      if (!current || item.distanceMeters < current.item.distanceMeters) {
        nearest.set(key, { item, arrivals });
      }
    }
  }

  const groups: NearbyRouteGroup[] = [];
  for (const [key, { item, arrivals }] of nearest) {
    const sorted = [...arrivals].sort((a, b) => a.time - b.time);
    const shown = pickShownArrivals(sorted);
    const [first] = shown;
    if (!first) continue;
    groups.push({
      key,
      routeId: first.routeId,
      routeShortName: first.routeShortName,
      routeColor: first.routeColor,
      routeTextColor: first.routeTextColor,
      directionId: first.directionId,
      headsign: first.headsign,
      stop: item.stop,
      distanceMeters: item.distanceMeters,
      arrivals: shown,
    });
  }

  return groups.sort((a, b) => {
    const timeDiff = (a.arrivals[0]?.time ?? 0) - (b.arrivals[0]?.time ?? 0);
    return timeDiff !== 0 ? timeDiff : a.distanceMeters - b.distanceMeters;
  });
}
