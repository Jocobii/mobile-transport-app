import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { colors } from "@/shared/theme";

export function LiveIcon() {
  const { t } = useTranslation();
  return <View style={styles.dot} accessible accessibilityLabel={t("arrival.liveIconLabel")} />;
}

const styles = StyleSheet.create({
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.live,
  },
});
