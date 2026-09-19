import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { Marker } from "react-native-maps";
import { colors, fontSizes, spacing } from "@/shared/theme";

const SELECTED_SIZE = 22;
const LABEL_OFFSET = SELECTED_SIZE / 2 + spacing.xs;

const STOP_DOT_IMAGE = require("../../../assets/map/stop-dot.png") as number;

interface StopMarkerProps {
  id: string;
  name: string;
  lat: number;
  lon: number;
  selected: boolean;
  onPress: (stopId: string) => void;
}

/** Turns `tracksViewChanges` off shortly after mount (a Google Maps performance need). */
function useSettledView(): boolean {
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setTracks(false), 500);
    return () => clearTimeout(timer);
  }, []);
  return tracks;
}

/**
 * Non-selected stops render as a native bitmap (`Marker image`, no view snapshot) so panning stays
 * smooth with many stops on screen. The selected stop keeps the custom view and shows its name.
 * Memoized: the parent keeps `onPress` stable so unrelated re-renders do not remount every stop.
 */
export const StopMarker = memo(function StopMarker({
  id,
  name,
  lat,
  lon,
  selected,
  onPress,
}: StopMarkerProps) {
  const { t } = useTranslation();
  const tracksViewChanges = useSettledView();
  const coordinate = { latitude: lat, longitude: lon };
  const label = t("map.stopMarkerLabel", { name });

  if (!selected) {
    return (
      <Marker
        coordinate={coordinate}
        image={STOP_DOT_IMAGE}
        anchor={{ x: 0.5, y: 0.5 }}
        tracksViewChanges={false}
        zIndex={1}
        accessible
        accessibilityLabel={label}
        onPress={() => onPress(id)}
      />
    );
  }

  return (
    <>
      <Marker
        coordinate={coordinate}
        anchor={{ x: 0.5, y: 0.5 }}
        tracksViewChanges={tracksViewChanges}
        zIndex={2}
        onPress={() => onPress(id)}
      >
        <View style={styles.selected} accessible accessibilityLabel={label} />
      </Marker>
      <StopLabel name={name} coordinate={coordinate} />
    </>
  );
});

interface StopLabelProps {
  name: string;
  coordinate: { latitude: number; longitude: number };
}

/** Separate marker anchored at its left edge so the text sits beside the stop circle. */
function StopLabel({ name, coordinate }: StopLabelProps) {
  const tracksViewChanges = useSettledView();
  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0, y: 0.5 }}
      tracksViewChanges={tracksViewChanges}
      zIndex={3}
      tappable={false}
    >
      <View style={styles.labelBox}>
        <Text style={styles.labelText} numberOfLines={1}>
          {name}
        </Text>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  selected: {
    width: SELECTED_SIZE,
    height: SELECTED_SIZE,
    borderRadius: SELECTED_SIZE / 2,
    backgroundColor: colors.ink,
    borderWidth: 3,
    borderColor: colors.surface,
    elevation: 4,
    shadowColor: colors.ink,
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  labelBox: {
    marginLeft: LABEL_OFFSET,
    maxWidth: 200,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.surface,
    elevation: 3,
  },
  labelText: {
    color: colors.ink,
    fontSize: fontSizes.body - 2,
    fontWeight: "600",
  },
});
