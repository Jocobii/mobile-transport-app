import type { RouteVehiclesResponse, VehicleDto } from "@transit/contracts";

/**
 * Vehicles of the filtered routes from one `routes/{id}/vehicles` request per route. A route whose
 * request failed is skipped so the others still show; only when every request failed is the first
 * error thrown, so the caller keeps its previous data. One entry per vehicle id.
 */
export function collectRouteVehicles(
  results: PromiseSettledResult<RouteVehiclesResponse>[],
): VehicleDto[] {
  const fulfilled = results.filter(
    (result): result is PromiseFulfilledResult<RouteVehiclesResponse> =>
      result.status === "fulfilled",
  );
  const firstFailure = results.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (fulfilled.length === 0 && firstFailure) throw firstFailure.reason;

  const byId = new Map<string, VehicleDto>();
  for (const { value } of fulfilled) {
    for (const vehicle of value.vehicles) {
      if (!byId.has(vehicle.id)) byId.set(vehicle.id, vehicle);
    }
  }
  return [...byId.values()];
}
