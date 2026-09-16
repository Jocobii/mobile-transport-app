import type { HealthResponse } from "@transit/contracts";

/**
 * Builds the health report.
 * Feed health and catalog version will be provided by the TransitService once agencies are wired.
 */
export function getHealth(nowEpochSeconds: number): HealthResponse {
  return {
    status: "ok",
    checkedAt: nowEpochSeconds,
    feeds: [],
  };
}
