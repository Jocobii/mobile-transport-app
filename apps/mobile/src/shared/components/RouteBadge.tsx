import { StyleSheet, Text, View } from "react-native";
import { routeColors } from "@/shared/format/route-colors";
import { fontSizes, monospaceFont, radii, spacing } from "@/shared/theme";

interface RouteBadgeProps {
  label: string;
  /** Official GTFS colors (`#RRGGBB`); missing values use the fallback. */
  color?: string | undefined;
  textColor?: string | undefined;
}

export function RouteBadge({ label, color, textColor }: RouteBadgeProps) {
  const palette = routeColors(color, textColor);
  return (
    <View style={[styles.badge, { backgroundColor: palette.background }]}>
      <Text style={[styles.text, { color: palette.text }]} numberOfLines={1}>
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
    alignItems: "center",
  },
  text: {
    fontFamily: monospaceFont,
    fontSize: fontSizes.body,
    fontWeight: "700",
  },
});
