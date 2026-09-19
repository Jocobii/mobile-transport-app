import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";
import type { Position } from "@/shared/geo/position";

export type UserLocation =
  | { status: "loading" }
  | { status: "available"; position: Position }
  | { status: "unavailable" };

/**
 * One foreground position on start and on every `recenter()`; no continuous watch.
 * Denied permission or a failed fix ends in `unavailable` (the app stays usable).
 */
export function useUserLocation() {
  const [location, setLocation] = useState<UserLocation>({ status: "loading" });

  const locate = useCallback(async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocation({ status: "unavailable" });
        return;
      }
      const fix = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation({
        status: "available",
        position: { lat: fix.coords.latitude, lon: fix.coords.longitude },
      });
    } catch {
      // Keep a previous good fix when a later attempt fails.
      setLocation((previous) =>
        previous.status === "available" ? previous : { status: "unavailable" },
      );
    }
  }, []);

  useEffect(() => {
    void locate();
  }, [locate]);

  return { location, recenter: locate };
}
