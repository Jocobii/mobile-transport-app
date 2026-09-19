import type { StopsInAreaResponse } from "@transit/contracts";
import type { StopsInAreaResult } from "@transit/core";
import { mapStop } from "./stop";

export function mapStopsInAreaResult(result: StopsInAreaResult): StopsInAreaResponse {
  return {
    stops: result.stops.map(mapStop),
    truncated: result.truncated,
  };
}
