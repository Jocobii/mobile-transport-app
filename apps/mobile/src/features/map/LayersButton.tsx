import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "@/shared/theme";

export const LAYERS_BUTTON_SIZE = 48;

interface LayersButtonProps {
  onPress: () => void;
}

/** Round map overlay button that opens the layer toggles card. Nearby panel only. */
export function LayersButton({ onPress }: LayersButtonProps) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("map.layers.button")}
      style={styles.button}
    >
      <LayersIcon />
    </Pressable>
  );
}

function LayersIcon() {
  return (
    <Svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path
        d="M12 3 2 8l10 5 10-5-10-5Z"
        stroke={colors.ink}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <Path
        d="M2 13l10 5 10-5"
        stroke={colors.ink}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M2 18l10 5 10-5"
        stroke={colors.ink}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  button: {
    width: LAYERS_BUTTON_SIZE,
    height: LAYERS_BUTTON_SIZE,
    borderRadius: LAYERS_BUTTON_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    elevation: 4,
  },
});
