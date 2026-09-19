import type { VehicleDto } from "@transit/contracts";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Marker } from "react-native-maps";
import { colors, monospaceFont, radii, spacing } from "@/shared/theme";
import { BEARING_STEP_DEGREES } from "./map-config";

interface VehicleMarkerProps {
  vehicle: VehicleDto;
}

/** Bearing rounded to the marker step, or undefined when the vehicle reports none. */
export function markerBearing(vehicle: VehicleDto): number | undefined {
  if (vehicle.bearing === undefined) return undefined;
  return Math.round(vehicle.bearing / BEARING_STEP_DEGREES) * BEARING_STEP_DEGREES;
}

/**
 * Black pill with the route number and an arrow rotated by the bearing.
 * The parent keys it by route and rounded bearing, so it remounts when its look changes and
 * `tracksViewChanges` can be turned off after the first render (a Google Maps performance need).
 */
export function VehicleMarker({ vehicle }: VehicleMarkerProps) {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const bearing = markerBearing(vehicle);

  useEffect(() => {
    const id = setTimeout(() => setTracksViewChanges(false), 300);
    return () => clearTimeout(id);
  }, []);

  return (
    <Marker
      coordinate={{ latitude: vehicle.lat, longitude: vehicle.lon }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracksViewChanges}
    >
      <View style={styles.pill}>
        <Text style={styles.label}>{vehicle.routeShortName}</Text>
        {bearing !== undefined ? (
          <Text style={[styles.arrow, { transform: [{ rotate: `${bearing}deg` }] }]}>▲</Text>
        ) : null}
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.badge,
    backgroundColor: colors.ink,
  },
  label: {
    color: colors.surface,
    fontFamily: monospaceFont,
    fontSize: 13,
    fontWeight: "700",
  },
  arrow: {
    color: colors.surface,
    fontSize: 10,
  },
});
