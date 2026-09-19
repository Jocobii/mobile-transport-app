import { StyleSheet, Text, View } from "react-native";
import { type ArrivalStatusTone, radii, spacing, statusColors } from "@/shared/theme";
import { ActionButton } from "./ActionButton";
import { StatusIcon } from "./StatusIcon";

interface NoticeCardProps {
  tone: ArrivalStatusTone;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Banner / info card painted with the status colors; icon + text, never color alone. */
export function NoticeCard({ tone, message, actionLabel, onAction }: NoticeCardProps) {
  const { fg, bg } = statusColors[tone];
  return (
    <View style={[styles.card, { backgroundColor: bg }]}>
      <View style={styles.message}>
        <StatusIcon status={tone} size={18} />
        <Text style={[styles.text, { color: fg }]}>{message}</Text>
      </View>
      {actionLabel && onAction ? <ActionButton label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.card,
  },
  message: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  text: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
  },
});
