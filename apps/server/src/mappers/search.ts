import type { SearchResult } from "@transit/core";
import type { SearchResponse } from "@transit/contracts";
import { mapRoute } from "./route";
import { mapStop } from "./stop";

export function mapSearchResult(result: SearchResult): SearchResponse {
  return {
    routes: result.routes.map(mapRoute),
    stops: result.stops.map(mapStop),
  };
}
