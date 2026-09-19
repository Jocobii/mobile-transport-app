import type { VehicleDto } from "@transit/contracts";
import { apiClient } from "@/api/client";
import { usePolledQuery } from "@/shared/polling/use-polled-query";
import { collectRouteVehicles } from "./filtered-vehicles";

/**
 * Live vehicles of the filtered routes, all directions, wherever they are (no zoom gate), polled
 * like the other live data. `undefined` while `routeIds` is undefined or before the first response.
 */
export function useFilteredVehicles(routeIds: string[] | undefined): VehicleDto[] | undefined {
  const query = usePolledQuery(
    `filtered-vehicles:${routeIds?.join(",") ?? ""}`,
    async () => {
      if (!routeIds) throw new Error("No route filter");
      const results = await Promise.allSettled(
        routeIds.map((routeId) => apiClient.getRouteVehicles(routeId)),
      );
      return collectRouteVehicles(results);
    },
    { enabled: routeIds !== undefined },
  );
  return routeIds ? query.data : undefined;
}
