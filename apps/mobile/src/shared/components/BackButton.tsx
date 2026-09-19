import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors } from "@/shared/theme";

export const BACK_BUTTON_SIZE = 48;

interface BackButtonProps {
  onPress: () => void;
}

export function BackButton({ onPress }: BackButtonProps) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("common.back")}
      style={styles.button}
    >
      <Text style={styles.icon}>←</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: BACK_BUTTON_SIZE,
    height: BACK_BUTTON_SIZE,
    borderRadius: BACK_BUTTON_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    elevation: 4,
  },
  icon: {
    color: colors.ink,
    fontSize: 24,
  },
});
