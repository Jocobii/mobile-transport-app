import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { Marker } from "react-native-maps";
import { colors, fontSizes, spacing } from "@/shared/theme";

const NORMAL_SIZE = 14;
const SELECTED_SIZE = 22;
const LABEL_OFFSET = SELECTED_SIZE / 2 + spacing.xs;

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
 * Small neutral circle; the selected stop grows and shows its name beside it.
 * The parent keys it by id and `selected`, so it remounts when its look changes.
 */
export function StopMarker({ id, name, lat, lon, selected, onPress }: StopMarkerProps) {
  const { t } = useTranslation();
  const tracksViewChanges = useSettledView();
  const coordinate = { latitude: lat, longitude: lon };

  return (
    <>
      <Marker
        coordinate={coordinate}
        anchor={{ x: 0.5, y: 0.5 }}
        tracksViewChanges={tracksViewChanges}
        zIndex={selected ? 2 : 1}
        onPress={() => onPress(id)}
      >
        <View
          style={selected ? styles.selected : styles.normal}
          accessible
          accessibilityLabel={t("map.stopMarkerLabel", { name })}
        />
      </Marker>
      {selected ? <StopLabel name={name} coordinate={coordinate} /> : null}
    </>
  );
}

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
  normal: {
    width: NORMAL_SIZE,
    height: NORMAL_SIZE,
    borderRadius: NORMAL_SIZE / 2,
    backgroundColor: colors.surface,
    borderWidth: 2.5,
    borderColor: "#6D6C67",
  },
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
