import type { VehicleDto } from "@transit/contracts";
import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { Marker } from "react-native-maps";
import Svg, { Path, Rect } from "react-native-svg";
import { routeColors } from "@/shared/format/route-colors";
import { colors, monospaceFont, spacing } from "@/shared/theme";
import { sameVehicleMarker } from "./vehicle-marker-key";

interface VehicleMarkerProps {
  vehicle: VehicleDto;
  onPress?: ((vehicle: VehicleDto) => void) | undefined;
}

const HALO_INSET = 5;
const MARKER_PADDING = 10;
const HALO_ALPHA = "40";

const BEARING_ARROW_IMAGE = require("../../../assets/map/bearing-arrow.png") as number;

export { vehicleMarkerKey } from "./vehicle-marker-key";

/**
 * Pill in the official route colors with a bus glyph and the route number, and a faint halo in
 * the route color. The parent keys it with `vehicleMarkerKey`, so it is rebuilt only when its look
 * changes and `tracksViewChanges` can be turned off after the first render (a Google Maps
 * performance need). The heading is a second, bitmap marker (an arrow that orbits the pill)
 * rotated natively: a turn changes one number, never a view snapshot.
 * Memoized by what is drawn, not by object identity: a poll returns new objects every time.
 */
export const VehicleMarker = memo(function VehicleMarker({ vehicle, onPress }: VehicleMarkerProps) {
  const { t } = useTranslation();
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const palette = routeColors(vehicle.routeColor, vehicle.routeTextColor);
  const coordinate = { latitude: vehicle.lat, longitude: vehicle.lon };

  useEffect(() => {
    const id = setTimeout(() => setTracksViewChanges(false), 500);
    return () => clearTimeout(id);
  }, []);

  return (
    <>
      <Marker
        coordinate={coordinate}
        anchor={{ x: 0.5, y: 0.5 }}
        tracksViewChanges={tracksViewChanges}
        zIndex={4}
        onPress={onPress ? () => onPress(vehicle) : undefined}
      >
        <View
          style={styles.container}
          accessible
          accessibilityLabel={t("map.busMarkerLabel", {
            route: vehicle.routeShortName,
            headsign: vehicle.headsign,
          })}
        >
          <View style={[styles.halo, { backgroundColor: `${palette.background}${HALO_ALPHA}` }]} />
          <View style={[styles.pill, { backgroundColor: palette.background }]}>
            <BusGlyph color={palette.text} />
            <Text style={[styles.label, { color: palette.text }]}>{vehicle.routeShortName}</Text>
          </View>
        </View>
      </Marker>
      {vehicle.bearing !== undefined ? (
        <Marker
          coordinate={coordinate}
          image={BEARING_ARROW_IMAGE}
          anchor={{ x: 0.5, y: 0.5 }}
          rotation={vehicle.bearing}
          tracksViewChanges={false}
          tappable={false}
          zIndex={5}
        />
      ) : null}
    </>
  );
}, propsEqual);

function propsEqual(previous: VehicleMarkerProps, next: VehicleMarkerProps): boolean {
  return previous.onPress === next.onPress && sameVehicleMarker(previous.vehicle, next.vehicle);
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
});
