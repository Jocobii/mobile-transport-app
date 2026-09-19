import { StyleSheet, Text, View } from "react-native";
import { colors, fontSizes, monospaceFont, radii, spacing } from "@/shared/theme";

interface RouteBadgeProps {
  label: string;
}

export function RouteBadge({ label }: RouteBadgeProps) {
  return (
    <View style={styles.badge}>
      <Text style={styles.text} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 44,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.badge,
    backgroundColor: colors.ink,
    alignItems: "center",
  },
  text: {
    color: colors.surface,
    fontFamily: monospaceFont,
    fontSize: fontSizes.body,
    fontWeight: "700",
  },
});
