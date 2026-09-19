import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MAX_FILTER_ROUTES } from "@/features/map/route-filter";
import { colors, fontSizes, radii, spacing } from "@/shared/theme";

interface RoutePickerBannerProps {
  /** The filter has reached its maximum; unselected routes cannot be added. */
  full: boolean;
  onDone: () => void;
}

/** Top of the search panel while choosing routes for the filter. */
export function RoutePickerBanner({ full, onDone }: RoutePickerBannerProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.banner}>
      <View style={styles.text}>
        <Text style={styles.title}>{t("routePicker.title")}</Text>
        {full ? (
          <Text style={styles.limit}>{t("routePicker.limit", { count: MAX_FILTER_ROUTES })}</Text>
        ) : null}
      </View>
      <Pressable
        onPress={onDone}
        accessibilityRole="button"
        accessibilityLabel={t("routePicker.done")}
        style={styles.done}
      >
        <Text style={styles.doneLabel}>{t("routePicker.done")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  text: {
    flex: 1,
  },
  title: {
    color: colors.ink,
    fontSize: fontSizes.body,
    fontWeight: "700",
  },
  limit: {
    color: colors.muted,
    fontSize: 13,
  },
  done: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: colors.ink,
  },
  doneLabel: {
    color: colors.surface,
    fontSize: fontSizes.body,
    fontWeight: "600",
  },
});
