import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii, spacing } from "@/shared/theme";

interface BottomPanelProps {
  height: number;
  children: ReactNode;
}

/** Fixed (not draggable) panel anchored to the bottom of the screen. */
export function BottomPanel({ height, children }: BottomPanelProps) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.panel, { height, paddingBottom: insets.bottom }]}>{children}</View>;
}

const styles = StyleSheet.create({
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    borderTopLeftRadius: radii.panel,
    borderTopRightRadius: radii.panel,
    backgroundColor: colors.surface,
    elevation: 8,
    shadowColor: colors.ink,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
  },
});
