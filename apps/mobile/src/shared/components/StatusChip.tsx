import { StyleSheet, Text, View } from "react-native";
import { type ArrivalStatusTone, radii, spacing, statusColors } from "@/shared/theme";
import { StatusIcon } from "./StatusIcon";

interface StatusChipProps {
  status: ArrivalStatusTone;
  label: string;
}

/** Icon + text chip painted with the status colors (never by color alone). */
export function StatusChip({ status, label }: StatusChipProps) {
  const { fg, bg } = statusColors[status];
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <StatusIcon status={status} />
      <Text style={[styles.label, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.badge,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
  },
});
