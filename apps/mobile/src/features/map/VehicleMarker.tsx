import type { VehicleDto } from "@transit/contracts";
import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { Marker } from "react-native-maps";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { outdatedPositionMinutes, secondsSince } from "@/shared/format/freshness";
import { routeColors } from "@/shared/format/route-colors";
import { colors, monospaceFont, spacing } from "@/shared/theme";
import { useClockSelect } from "@/shared/time/use-clock-select";
import { sameVehicleMarker } from "./vehicle-marker-key";

interface VehicleMarkerProps {
  vehicle: VehicleDto;
  onPress?: ((vehicle: VehicleDto) => void) | undefined;
}

const HALO_INSET = 5;
const MARKER_PADDING = 10;
const HALO_ALPHA = "40";
/**
 * Opacity of a bus whose GPS report is outdated. Only slightly lighter: the clock and the age
 * ("1 min") carry the meaning, the fade just keeps fresh buses visually first.
 */
const OUTDATED_OPACITY = 0.75;
/** How long the pill keeps re-snapshotting after its look changes (mount, age label). */
const SNAPSHOT_MS = 500;

const BEARING_ARROW_IMAGE = require("../../../assets/map/bearing-arrow.png") as number;

export { vehicleMarkerKey } from "./vehicle-marker-key";

/**
 * Pill in the official route colors with a bus glyph and the route number, and a faint halo in
 * the route color. The parent keys it with `vehicleMarkerKey`, so it is rebuilt only when its look
 * changes and `tracksViewChanges` can be turned off after the first render (a Google Maps
 * performance need). The heading is a second, bitmap marker (an arrow that orbits the pill)
 * rotated natively: a turn changes one number, never a view snapshot. When the GPS report is
 * outdated the pill adds a clock with its age ("1 min") and both markers get slightly lighter,
 * because the bus is probably further along than drawn.
 * Memoized by what is drawn, not by object identity: a poll returns new objects every time.
 */
export const VehicleMarker = memo(function VehicleMarker({ vehicle, onPress }: VehicleMarkerProps) {
  const { t } = useTranslation();
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const palette = routeColors(vehicle.routeColor, vehicle.routeTextColor);
  const coordinate = { latitude: vehicle.lat, longitude: vehicle.lon };
  // Re-renders only when the shown minute changes, not on every clock tick.
  const outdatedMinutes = useClockSelect((now) =>
    outdatedPositionMinutes(secondsSince(vehicle.updatedAt, now)),
  );
  const opacity = outdatedMinutes === undefined ? 1 : OUTDATED_OPACITY;

  // The pill is a bitmap once `tracksViewChanges` is off, so take a new snapshot whenever the age
  // label changes (at most once a minute per outdated bus).
  // biome-ignore lint/correctness/useExhaustiveDependencies: `outdatedMinutes` changes the drawn pill.
  useEffect(() => {
    setTracksViewChanges(true);
    const id = setTimeout(() => setTracksViewChanges(false), SNAPSHOT_MS);
    return () => clearTimeout(id);
  }, [outdatedMinutes]);

  return (
    <>
      <Marker
        coordinate={coordinate}
        anchor={{ x: 0.5, y: 0.5 }}
        tracksViewChanges={tracksViewChanges}
        opacity={opacity}
        zIndex={4}
        onPress={onPress ? () => onPress(vehicle) : undefined}
      >
        <View
          style={styles.container}
          accessible
          accessibilityLabel={
            outdatedMinutes === undefined
              ? t("map.busMarkerLabel", {
                  route: vehicle.routeShortName,
                  headsign: vehicle.headsign,
                })
              : t("map.busMarkerLabelOutdated", {
                  route: vehicle.routeShortName,
                  headsign: vehicle.headsign,
                  minutes: outdatedMinutes,
                })
          }
        >
          <View style={[styles.halo, { backgroundColor: `${palette.background}${HALO_ALPHA}` }]} />
          <View style={[styles.pill, { backgroundColor: palette.background }]}>
            <BusGlyph color={palette.text} />
            <Text style={[styles.label, { color: palette.text }]}>{vehicle.routeShortName}</Text>
            {outdatedMinutes === undefined ? null : (
              <>
                <View style={[styles.divider, { backgroundColor: palette.text }]} />
                <ClockGlyph color={palette.text} />
                <Text style={[styles.age, { color: palette.text }]}>
                  {t("map.busMarkerAge", { minutes: outdatedMinutes })}
                </Text>
              </>
            )}
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
          opacity={opacity}
          zIndex={5}
        />
      ) : null}
    </>
  );
}, propsEqual);

function propsEqual(previous: VehicleMarkerProps, next: VehicleMarkerProps): boolean {
  // `updatedAt` is compared here, not in `sameVehicleMarker`: it only drives the native opacity, and
  // a stopped bus that reports again must stop looking outdated.
  return (
    previous.onPress === next.onPress &&
    previous.vehicle.updatedAt === next.vehicle.updatedAt &&
    sameVehicleMarker(previous.vehicle, next.vehicle)
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

function ClockGlyph({ color }: { color: string }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 16 16" fill="none">
      <Circle cx="8" cy="8" r="6.2" stroke={color} strokeWidth="1.8" />
      <Path d="M8 4.5V8l2.5 1.8" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
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
  divider: {
    width: 1,
    alignSelf: "stretch",
    opacity: 0.5,
  },
  age: {
    fontSize: 12,
    fontWeight: "600",
  },
});
