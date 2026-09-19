import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, fontSizes, radii, spacing } from "@/shared/theme";

export const SEARCH_BAR_HEIGHT = 48;

interface SearchBarProps {
  onPress: () => void;
}

/** Floating search entry point; the actual input lives in the search panel. */
export function SearchBar({ onPress }: SearchBarProps) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="search"
      accessibilityLabel={t("search.placeholder")}
      style={styles.bar}
    >
      <Text style={styles.placeholder}>{t("search.placeholder")}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: SEARCH_BAR_HEIGHT,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    elevation: 4,
    shadowColor: colors.ink,
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  placeholder: {
    color: colors.muted,
    fontSize: fontSizes.body,
  },
});
