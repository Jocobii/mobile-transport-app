import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import { colors } from "@/shared/theme";
import { CloseIcon } from "./icons/CloseIcon";

export const CLOSE_BUTTON_TOUCH_SIZE = 48;
const CLOSE_BUTTON_VISUAL_SIZE = 40;

interface CloseButtonProps {
  onPress: () => void;
}

/** Circular ✕ (40 dp circle inside a 48 dp touch target). Closing pops one panel level. */
export function CloseButton({ onPress }: CloseButtonProps) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("common.close")}
      style={styles.touchTarget}
    >
      <View style={styles.circle}>
        <CloseIcon />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touchTarget: {
    width: CLOSE_BUTTON_TOUCH_SIZE,
    height: CLOSE_BUTTON_TOUCH_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  circle: {
    width: CLOSE_BUTTON_VISUAL_SIZE,
    height: CLOSE_BUTTON_VISUAL_SIZE,
    borderRadius: CLOSE_BUTTON_VISUAL_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.map,
  },
});
