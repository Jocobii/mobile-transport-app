import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontSizes, radii, spacing } from "@/shared/theme";

interface MyStopChipProps {
  stopName: string;
  onClear: () => void;
}

/** Shown under the search bar in Nearby while a stop is highlighted; ✕ clears it. */
export function MyStopChip({ stopName, onClear }: MyStopChipProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.chip}>
      <Text style={styles.label} numberOfLines={1}>
        {t("map.myStop", { name: stopName })}
      </Text>
      <Pressable
        onPress={onClear}
        accessibilityRole="button"
        accessibilityLabel={t("map.clearMyStop")}
        style={styles.clearButton}
      >
        <Text style={styles.clearIcon}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    maxWidth: "100%",
    paddingLeft: spacing.md,
    borderRadius: radii.panel,
    backgroundColor: colors.surface,
    elevation: 4,
    shadowColor: colors.ink,
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  label: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: fontSizes.body,
    fontWeight: "600",
  },
  clearButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  clearIcon: {
    color: colors.ink,
    fontSize: 16,
  },
});
