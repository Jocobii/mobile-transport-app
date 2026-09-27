import type { TransitModeDto, VehicleDto } from "@transit/contracts";
import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { Marker } from "react-native-maps";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { outdatedPositionMinutes, secondsSince } from "@/shared/format/freshness";
import { routeColors } from "@/shared/format/route-colors";
import { colors, monospaceFont, spacing } from "@/shared/theme";
import { useClockSelect } from "@/shared/time/use-clock-select";
import { mapRouteName, type VehicleLabelDetail } from "./vehicle-label";
import { sameVehicleMarker } from "./vehicle-marker-key";
import { isRailMode, type VehicleShape, vehicleMode, vehicleShape } from "./vehicle-mode";

interface VehicleMarkerProps {
  vehicle: VehicleDto;
  /** How much the label shows, by the free space around the vehicle (`placeVehicleLabels`). */
  labelDetail: VehicleLabelDetail;
  onPress?: ((vehicle: VehicleDto) => void) | undefined;
}

/** Puck canvas (dp). The circle is centered, so rotating around the center keeps it in place. */
const PUCK_SIZE = 36;
const PUCK_CENTER = PUCK_SIZE / 2;
const PUCK_RADIUS = 11;
/** Heading tip: tangent teardrop from the circle to a point 15 dp above its center. */
const PUCK_TIP_PATH = "M18 3 L25.48 9.93 A11 11 0 1 1 10.52 9.93 Z";
/** Train puck: a 24 dp rounded square (a bit bigger than the bus circle: trains are bigger). */
const SQUARE_ORIGIN = 6;
const SQUARE_SIZE = 24;
const SQUARE_RADIUS = 5;
/**
 * Moving train: the rounded square with a pointed nose on its top edge, as one path (one clean
 * outline). The whole top edge is the tip, so the heading still reads when the train runs diagonal.
 */
const SQUARE_TIP_PATH = "M18 2 L30 10 V25 A5 5 0 0 1 25 30 H11 A5 5 0 0 1 6 25 V10 Z";
/**
 * Dark hairline around the white outline, so light route colors (yellow, gray) still stand out from
 * the light map: non-text contrast (WCAG 1.4.11) for every route color.
 */
const OUTLINE_HALO = "rgba(29, 29, 27, 0.35)";
/** Space under the label so it sits just above the puck's tip, whatever the heading. */
const LABEL_GAP = 17;
/**
 * Opacity of a bus whose GPS report is outdated. Only slightly lighter: the clock and the age
 * ("1 min") carry the meaning, the fade just keeps fresh buses visually first.
 */
const OUTDATED_OPACITY = 0.75;
/** Trains draw above buses where they overlap (stations, downtown): fewer, and more important. */
const BUS_Z_INDEX = 4;
const RAIL_Z_INDEX = 6;
/** How long a marker keeps re-snapshotting after its look changes (mount, age label, tip). */
const SNAPSHOT_MS = 500;

export { vehicleMarkerKey } from "./vehicle-marker-key";

/**
 * A vehicle is two markers at the same point. Its transit mode (`vehicleMode`) is shown three
 * redundant ways so it reads at a glance, without relying on color: the puck's **shape** (round
 * for buses, square for trains), its **center** (a dot for buses, a ring for BRT) and the label's
 * **glyph** (bus, rapid bus, light rail, train). Trains also sit above buses and get their label
 * placed first. Screen readers hear the mode first.
 * - the **puck**: a circle (square for trains) in the route color with a tip pointing where it is heading (plain when
 *   the feed sends no bearing). It is flat on the map and rotated natively with
 *   `rotation`, so a turn changes one number and never rebuilds its bitmap, and the tip stays
 *   right when the user rotates the map;
 * - the **label**: a pill above the puck that never rotates, so the number always reads upright.
 *   Its detail comes from the free space around the vehicle (`labelDetail`, see
 *   `placeVehicleLabels`): the full label (mode glyph, number and, when the GPS report is outdated,
 *   a clock with its age) when it fits, the number alone when only that fits, and hidden (opacity
 *   0, kept mounted: mass add/remove of markers is unreliable on Android) in a crowd.
 *   An outdated bus is also drawn slightly lighter, because it is probably further along.
 * Both are view snapshots (`tracksViewChanges` only while their look changes, a Google Maps
 * performance need). Memoized by what is drawn: a poll returns new objects every time.
 */
export const VehicleMarker = memo(function VehicleMarker({
  vehicle,
  labelDetail,
  onPress,
}: VehicleMarkerProps) {
  const { t } = useTranslation();
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const palette = routeColors(vehicle.routeColor, vehicle.routeTextColor);
  const coordinate = { latitude: vehicle.lat, longitude: vehicle.lon };
  const hasBearing = vehicle.bearing !== undefined;
  const mode = vehicleMode(vehicle);
  const detail = labelDetail;
  const zIndexBase = isRailMode(mode) ? RAIL_Z_INDEX : BUS_Z_INDEX;
  // Re-renders only when the shown minute changes, not on every clock tick.
  const outdatedMinutes = useClockSelect((now) =>
    outdatedPositionMinutes(secondsSince(vehicle.updatedAt, now)),
  );
  const opacity = outdatedMinutes === undefined ? 1 : OUTDATED_OPACITY;
  const showLabel = detail !== "none";
  const isFull = detail === "full";
  const routeName = mapRouteName(vehicle.routeShortName);
  const handlePress = onPress ? () => onPress(vehicle) : undefined;

  // Snapshots are bitmaps once `tracksViewChanges` is off, so take new ones whenever what they
  // draw changes: the age label (at most once a minute), the tip appearing/disappearing, or the
  // label detail (only when the free space around the vehicle changes).
  // biome-ignore lint/correctness/useExhaustiveDependencies: these values change the drawn markers.
  useEffect(() => {
    setTracksViewChanges(true);
    const id = setTimeout(() => setTracksViewChanges(false), SNAPSHOT_MS);
    return () => clearTimeout(id);
  }, [outdatedMinutes, hasBearing, detail]);

  return (
    <>
      <Marker
        coordinate={coordinate}
        anchor={{ x: 0.5, y: 0.5 }}
        rotation={vehicle.bearing ?? 0}
        // Flat: the tip stays relative to map north even when the user rotates the map.
        flat
        tracksViewChanges={tracksViewChanges}
        opacity={opacity}
        zIndex={zIndexBase}
        onPress={handlePress}
      >
        <Puck
          shape={vehicleShape(mode)}
          ringCenter={mode === "brt"}
          color={palette.background}
          dotColor={palette.text}
          hasBearing={hasBearing}
        />
      </Marker>
      <Marker
        coordinate={coordinate}
        anchor={{ x: 0.5, y: 1 }}
        tracksViewChanges={tracksViewChanges}
        opacity={showLabel ? opacity : 0}
        tappable={showLabel}
        zIndex={zIndexBase + 1}
        onPress={handlePress}
      >
        <View
          style={styles.labelContainer}
          accessible
          accessibilityLabel={
            outdatedMinutes === undefined
              ? t("map.vehicleMarkerLabel", {
                  mode: t(`map.vehicleMode.${mode}`),
                  route: vehicle.routeShortName,
                  headsign: vehicle.headsign,
                })
              : t("map.vehicleMarkerLabelOutdated", {
                  mode: t(`map.vehicleMode.${mode}`),
                  route: vehicle.routeShortName,
                  headsign: vehicle.headsign,
                  minutes: outdatedMinutes,
                })
          }
        >
          <View
            style={[
              styles.pill,
              isRailMode(mode) ? styles.pillSquare : null,
              { backgroundColor: palette.background },
            ]}
          >
            {isFull ? <ModeGlyph mode={mode} color={palette.text} /> : null}
            <Text style={[styles.label, { color: palette.text }]}>{routeName}</Text>
            {!isFull || outdatedMinutes === undefined ? null : (
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
    </>
  );
}, propsEqual);

function propsEqual(previous: VehicleMarkerProps, next: VehicleMarkerProps): boolean {
  // `updatedAt` is compared here, not in `sameVehicleMarker`: it only drives the age label, and a
  // stopped bus that reports again must stop looking outdated.
  return (
    previous.onPress === next.onPress &&
    previous.labelDetail === next.labelDetail &&
    previous.vehicle.updatedAt === next.vehicle.updatedAt &&
    sameVehicleMarker(previous.vehicle, next.vehicle)
  );
}

interface PuckProps {
  shape: VehicleShape;
  /** BRT: a ring in the center instead of a dot, the "rapid" variant of the bus puck. */
  ringCenter: boolean;
  color: string;
  dotColor: string;
  hasBearing: boolean;
}

/**
 * Drawn pointing north (heading 0); the marker's `rotation` turns it to the vehicle's bearing.
 * Everything inside is symmetric around the center, so rotating it never looks wrong.
 */
function Puck({ shape, ringCenter, color, dotColor, hasBearing }: PuckProps) {
  const outline = (stroke: string, strokeWidth: number, fill: string) => {
    const common = { fill, stroke, strokeWidth, strokeLinejoin: "round" as const };
    if (shape === "square") {
      return hasBearing ? (
        <Path d={SQUARE_TIP_PATH} {...common} />
      ) : (
        <Rect
          x={SQUARE_ORIGIN}
          y={SQUARE_ORIGIN}
          width={SQUARE_SIZE}
          height={SQUARE_SIZE}
          rx={SQUARE_RADIUS}
          {...common}
        />
      );
    }
    return hasBearing ? (
      <Path d={PUCK_TIP_PATH} {...common} />
    ) : (
      <Circle cx={PUCK_CENTER} cy={PUCK_CENTER} r={PUCK_RADIUS} {...common} />
    );
  };
  return (
    <Svg width={PUCK_SIZE} height={PUCK_SIZE} viewBox={`0 0 ${PUCK_SIZE} ${PUCK_SIZE}`}>
      {outline(OUTLINE_HALO, 4.5, "none")}
      {outline(colors.surface, 2.5, color)}
      {shape === "square" ? (
        <Rect x={14} y={14} width={8} height={8} rx={2} fill={dotColor} />
      ) : ringCenter ? (
        <Circle
          cx={PUCK_CENTER}
          cy={PUCK_CENTER}
          r={4.5}
          fill="none"
          stroke={dotColor}
          strokeWidth={2.2}
        />
      ) : (
        <Circle cx={PUCK_CENTER} cy={PUCK_CENTER} r={3.5} fill={dotColor} />
      )}
    </Svg>
  );
}

/** Label glyph for the vehicle's mode: the same icon family, so it reads as one system. */
function ModeGlyph({ mode, color }: { mode: TransitModeDto; color: string }) {
  switch (mode) {
    case "brt":
      return <BrtGlyph color={color} />;
    case "lightRail":
      return <LightRailGlyph color={color} />;
    case "rail":
      return <TrainGlyph color={color} />;
    default:
      return <BusGlyph color={color} />;
  }
}

function BusGlyph({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 16 16" fill="none">
      <Rect x="2" y="2" width="12" height="10" rx="2" stroke={color} strokeWidth="1.6" />
      <Path d="M2 8h12M4.5 14.5v-2.5M11.5 14.5v-2.5" stroke={color} strokeWidth="1.6" />
    </Svg>
  );
}

/** A bus with speed lines: rapid transit, still a bus. */
function BrtGlyph({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 16 16" fill="none">
      <Rect x="5" y="2" width="10" height="10" rx="2" stroke={color} strokeWidth="1.6" />
      <Path
        d="M5 8h10M7.5 14.5v-2.5M12.5 14.5v-2.5M0.8 5h2.6M0.8 8.5h2.6"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** A tram with its pantograph and rails: light rail. */
function LightRailGlyph({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 16 16" fill="none">
      <Rect x="3" y="4" width="10" height="8.5" rx="2" stroke={color} strokeWidth="1.6" />
      <Path
        d="M5.5 1.2h5M8 1.2V4M3 8.2h10M5 12.5l-1.5 2.5M11 12.5l1.5 2.5"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** A train front with headlights: commuter or heavy rail. */
function TrainGlyph({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 16 16" fill="none">
      <Rect x="3" y="1.5" width="10" height="11" rx="3" stroke={color} strokeWidth="1.6" />
      <Path
        d="M3 7h10M5 12.5l-1.5 2.5M11 12.5l1.5 2.5"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <Circle cx="6" cy="10" r="0.9" fill={color} />
      <Circle cx="10" cy="10" r="0.9" fill={color} />
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
  labelContainer: {
    alignItems: "center",
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingBottom: LABEL_GAP,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.surface,
    elevation: 3,
    shadowColor: colors.ink,
    shadowOpacity: 0.25,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  /** Trains get a squarer label, matching their square puck. */
  pillSquare: {
    borderRadius: 5,
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
