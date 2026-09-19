import { ApiError } from "@transit/api-client";
import { apiClient } from "@/api/client";
import { usePolledQuery } from "@/shared/polling/use-polled-query";

/** Live detail of one vehicle (upcoming stops with ETAs); idle while `vehicleId` is undefined. */
export function useVehicleDetail(vehicleId: string | undefined) {
  return usePolledQuery(
    `vehicle:${vehicleId ?? ""}`,
    () => {
      if (vehicleId === undefined) return Promise.reject(new Error("No vehicle selected"));
      return apiClient.getVehicleDetail(vehicleId);
    },
    { enabled: vehicleId !== undefined },
  );
}

/** True when the vehicle is no longer in the live feed. */
export function isVehicleGone(error: unknown): boolean {
  return error instanceof ApiError && error.code === "not_found";
}
