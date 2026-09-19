import type { VehicleDto } from "@transit/contracts";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Marker } from "react-native-maps";
import Svg, { Path, Rect } from "react-native-svg";
import { routeColors } from "@/shared/format/route-colors";
import { colors, monospaceFont, spacing } from "@/shared/theme";
import { BEARING_STEP_DEGREES } from "./map-config";

interface VehicleMarkerProps {
  vehicle: VehicleDto;
}

const HALO_INSET = 5;
const ARROW_CIRCLE = 20;
const MARKER_PADDING = 10;
const HALO_ALPHA = "40";

/** Bearing rounded to the marker step, or undefined when the vehicle reports none. */
export function markerBearing(vehicle: VehicleDto): number | undefined {
  if (vehicle.bearing === undefined) return undefined;
  return Math.round(vehicle.bearing / BEARING_STEP_DEGREES) * BEARING_STEP_DEGREES;
}

/** Key that changes whenever the marker's look changes (route, colors, rounded bearing). */
export function vehicleMarkerKey(vehicle: VehicleDto): string {
  return [
    vehicle.id,
    vehicle.routeShortName,
    vehicle.routeColor ?? "none",
    vehicle.routeTextColor ?? "none",
    markerBearing(vehicle) ?? "none",
  ].join(":");
}

/**
 * Pill in the official route colors with a bus glyph and the route number, a faint halo in the
 * route color, and a separate white circle with an arrow rotated by the bearing.
 * The parent keys it with `vehicleMarkerKey`, so it remounts when its look changes and
 * `tracksViewChanges` can be turned off after the first render (a Google Maps performance need).
 */
export function VehicleMarker({ vehicle }: VehicleMarkerProps) {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const bearing = markerBearing(vehicle);
  const palette = routeColors(vehicle.routeColor, vehicle.routeTextColor);

  useEffect(() => {
    const id = setTimeout(() => setTracksViewChanges(false), 500);
    return () => clearTimeout(id);
  }, []);

  return (
    <Marker
      coordinate={{ latitude: vehicle.lat, longitude: vehicle.lon }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracksViewChanges}
    >
      <View style={styles.container}>
        <View style={[styles.halo, { backgroundColor: `${palette.background}${HALO_ALPHA}` }]} />
        <View style={[styles.pill, { backgroundColor: palette.background }]}>
          <BusGlyph color={palette.text} />
          <Text style={[styles.label, { color: palette.text }]}>{vehicle.routeShortName}</Text>
        </View>
        {bearing !== undefined ? (
          <View style={styles.arrowCircle}>
            <View style={{ transform: [{ rotate: `${bearing}deg` }] }}>
              <Svg width={12} height={12} viewBox="0 0 16 16">
                <Path d="M8 1.5 13.5 14 8 11 2.5 14Z" fill={palette.background} />
              </Svg>
            </View>
          </View>
        ) : null}
      </View>
    </Marker>
  );
}

function BusGlyph({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 16 16" fill="none">
      <Rect x="2" y="2" width="12" height="10" rx="2" stroke={color} strokeWidth="1.6" />
      <Path d="M2 8h12M4.5 14.5v-2.5M11.5 14.5v-2.5" stroke={color} strokeWidth="1.6" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: MARKER_PADDING,
  },
  halo: {
    position: "absolute",
    top: HALO_INSET,
    left: HALO_INSET,
    right: HALO_INSET,
    bottom: HALO_INSET,
    borderRadius: 18,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.surface,
    elevation: 4,
    shadowColor: colors.ink,
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  label: {
    fontFamily: monospaceFont,
    fontSize: 13,
    fontWeight: "700",
  },
  arrowCircle: {
    position: "absolute",
    top: 0,
    right: 0,
    width: ARROW_CIRCLE,
    height: ARROW_CIRCLE,
    borderRadius: ARROW_CIRCLE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    elevation: 5,
  },
});
