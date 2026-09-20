import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fontSizes, spacing } from "@/shared/theme";
import { SheetDragArea } from "./BottomSheet";
import { CloseButton } from "./CloseButton";

interface PanelHeaderProps {
  /** A string is rendered as the panel title (max 2 lines); a node is rendered as is. */
  title: ReactNode;
  subtitle?: ReactNode;
  /** Shows the ✕ when given. Nearby has none: there is nothing below it to return to. */
  onClose?: (() => void) | undefined;
}

/** Title block of a panel, inside the sheet, with the ✕ on the right. Dragging it moves the sheet. */
export function PanelHeader({ title, subtitle, onClose }: PanelHeaderProps) {
  return (
    <SheetDragArea>
      <View style={styles.row}>
        <View style={styles.texts}>
          {typeof title === "string" ? (
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
          ) : (
            title
          )}
          {typeof subtitle === "string" ? (
            <Text style={styles.subtitle}>{subtitle}</Text>
          ) : (
            subtitle
          )}
        </View>
        {onClose ? <CloseButton onPress={onClose} /> : null}
      </View>
    </SheetDragArea>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  texts: {
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
  },
  title: {
    color: colors.ink,
    fontSize: fontSizes.title,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.inkSecondary,
    fontSize: fontSizes.body,
  },
});
