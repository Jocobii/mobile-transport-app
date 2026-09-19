import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SEARCH_MAX_LENGTH } from "@/shared/config";
import { colors, fontSizes, radii, spacing } from "@/shared/theme";
import { SEARCH_BAR_HEIGHT } from "./SearchBar";

interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onClose: () => void;
}

/** The search bar once the search panel is open: focused input with close and clear buttons. */
export function SearchInput({ value, onChangeText, onClose }: SearchInputProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.bar}>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t("search.close")}
        style={styles.iconButton}
      >
        <Text style={styles.icon}>←</Text>
      </Pressable>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={t("search.placeholder")}
        placeholderTextColor={colors.muted}
        maxLength={SEARCH_MAX_LENGTH}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        style={styles.input}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText("")}
          accessibilityRole="button"
          accessibilityLabel={t("search.clear")}
          style={styles.iconButton}
        >
          <Text style={styles.icon}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: SEARCH_BAR_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    elevation: 4,
    shadowColor: colors.ink,
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  iconButton: {
    width: 44,
    height: SEARCH_BAR_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    color: colors.ink,
    fontSize: 20,
  },
  input: {
    flex: 1,
    height: SEARCH_BAR_HEIGHT,
    paddingHorizontal: spacing.xs,
    color: colors.ink,
    fontSize: fontSizes.body,
  },
});
