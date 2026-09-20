import { apiClient } from "./client";

/**
 * Wakes the server while the permission dialog and the GPS fix are still pending, so a cold start
 * (seconds) overlaps with them instead of following them. Fire and forget: the result is unused.
 */
export function prewarmServer(): void {
  apiClient.getHealth().catch(() => undefined);
}
