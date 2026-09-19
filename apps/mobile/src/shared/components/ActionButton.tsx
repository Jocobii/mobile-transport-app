import { Pressable, StyleSheet, Text } from "react-native";
import { colors, fontSizes, radii, spacing } from "@/shared/theme";

interface ActionButtonProps {
  label: string;
  onPress: () => void;
}

/** Secondary button (outlined), at least 44 dp tall. */
export function ActionButton({ label, onPress }: ActionButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.button}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    alignSelf: "flex-start",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.ink,
  },
  label: {
    color: colors.ink,
    fontSize: fontSizes.body,
    fontWeight: "600",
  },
});
