import type { HealthResponse } from "@transit/contracts";
import type { HealthResult } from "@transit/core";
import { mapFeedStatus } from "./feed-status";

export function mapHealthResult(result: HealthResult): HealthResponse {
  return {
    status: result.status,
    checkedAt: result.checkedAt,
    catalogVersion: result.catalogVersion,
    feeds: result.feeds.map(mapFeedStatus),
  };
}
