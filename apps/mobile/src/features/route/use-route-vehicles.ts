import { apiClient } from "@/api/client";
import { usePolledQuery } from "@/shared/polling/use-polled-query";

/** Live vehicles of a route, both directions; idle while `routeId` is undefined. */
export function useRouteVehicles(routeId: string | undefined) {
  return usePolledQuery(
    `route-vehicles:${routeId ?? ""}`,
    () => {
      if (routeId === undefined) return Promise.reject(new Error("No route selected"));
      return apiClient.getRouteVehicles(routeId);
    },
    { enabled: routeId !== undefined },
  );
}
