import { apiClient } from "@/api/client";
import { usePolledQuery } from "@/shared/polling/use-polled-query";

/** Arrivals of one stop; idle while `stopId` is undefined. */
export function useStopArrivals(stopId: string | undefined) {
  return usePolledQuery(
    `stop:${stopId ?? ""}`,
    () => {
      if (stopId === undefined) return Promise.reject(new Error("No stop selected"));
      return apiClient.getStopArrivals(stopId);
    },
    { enabled: stopId !== undefined },
  );
}
