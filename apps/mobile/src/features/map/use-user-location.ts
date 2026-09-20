import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";
import type { Position } from "@/shared/geo/position";
import { LAST_POSITION_STORAGE_KEY, parseStoredPosition } from "@/shared/geo/stored-position";
import { readStored, writeStored } from "@/shared/storage/storage";

export type UserLocation =
  | { status: "loading" }
  | { status: "available"; position: Position }
  | { status: "unavailable" };

function initialLocation(): UserLocation {
  const stored = parseStoredPosition(readStored(LAST_POSITION_STORAGE_KEY) ?? null);
  return stored ? { status: "available", position: stored } : { status: "loading" };
}

/**
 * One foreground position on start and on every `recenter()`; no continuous watch.
 * The start does not wait for the GPS: it begins with the last saved position (so Nearby can load
 * at once), then the system's last known fix, and finally the fresh fix replaces them.
 * Denied permission or a failed fix ends in `unavailable` (the app stays usable).
 */
export function useUserLocation() {
  const [location, setLocation] = useState<UserLocation>(initialLocation);

  const locate = useCallback(async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocation({ status: "unavailable" });
        return;
      }

      const lastKnown = await Location.getLastKnownPositionAsync().catch(() => null);
      if (lastKnown) {
        setLocation((previous) =>
          previous.status === "available"
            ? previous
            : {
                status: "available",
                position: { lat: lastKnown.coords.latitude, lon: lastKnown.coords.longitude },
              },
        );
      }

      const fix = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const position = { lat: fix.coords.latitude, lon: fix.coords.longitude };
      writeStored(LAST_POSITION_STORAGE_KEY, JSON.stringify(position));
      setLocation({ status: "available", position });
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
