import type { RouteSummaryDto, SearchResponse, StopSummaryDto } from "@transit/contracts";

export type SearchItem =
  | { kind: "route"; route: RouteSummaryDto }
  | { kind: "stop"; stop: StopSummaryDto };

export interface SearchSection {
  title: "search.routes" | "search.stops";
  data: SearchItem[];
}

/** Sections to show for a search response; `routesOnly` (route picker) leaves the stops out. */
export function toSearchSections(data: SearchResponse, routesOnly: boolean): SearchSection[] {
  const sections: SearchSection[] = [];
  if (data.routes.length > 0) {
    sections.push({
      title: "search.routes",
      data: data.routes.map((route) => ({ kind: "route", route })),
    });
  }
  if (!routesOnly && data.stops.length > 0) {
    sections.push({
      title: "search.stops",
      data: data.stops.map((stop) => ({ kind: "stop", stop })),
    });
  }
  return sections;
}
