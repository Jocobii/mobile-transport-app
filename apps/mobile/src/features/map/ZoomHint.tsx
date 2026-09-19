import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radii, spacing } from "@/shared/theme";

interface ZoomHintProps {
  onPress: () => void;
}

/** Tappable map chip shown when the stops layer is on but zoomed out past its gate. */
export function ZoomHint({ onPress }: ZoomHintProps) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("map.zoomInForStops")}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
    >
      <Text style={styles.label}>{t("map.zoomInForStops")}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: "center",
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.panel,
    backgroundColor: colors.surface,
    elevation: 4,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "600",
  },
});
