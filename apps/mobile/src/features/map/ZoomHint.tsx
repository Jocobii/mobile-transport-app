import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "@/shared/theme";

/** Map overlay chip shown when the stops layer is on but zoomed out past its gate. */
export function ZoomHint() {
  const { t } = useTranslation();
  return (
    <View style={styles.chip} accessible accessibilityLabel={t("map.zoomInForStops")}>
      <Text style={styles.label}>{t("map.zoomInForStops")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.panel,
    backgroundColor: colors.surface,
    elevation: 4,
  },
  label: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "600",
  },
});
