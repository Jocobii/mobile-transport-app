import type { ArrivalDto } from "@transit/contracts";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronIcon } from "@/shared/components/ChevronIcon";
import { RouteBadge } from "@/shared/components/RouteBadge";
import { StatusChip } from "@/shared/components/StatusChip";
import { formatArrivalStatus } from "@/shared/format/arrival-status";
import { formatArrivalTime } from "@/shared/format/arrival-time";
import { colors, fontSizes, monospaceFont, radii, spacing, statusTimeColors } from "@/shared/theme";

interface StopArrivalRowProps {
  arrival: ArrivalDto;
  now: number;
  onPress?: ((arrival: ArrivalDto) => void) | undefined;
}

/** Tappable arrival card of the stop panel: the time is the biggest element. */
export function StopArrivalRow({ arrival, now, onPress }: StopArrivalRowProps) {
  const { t } = useTranslation();
  const time = formatArrivalTime(arrival, now, {
    now: t("arrival.now"),
    minutesUnit: t("arrival.minutes"),
  });
  const status = formatArrivalStatus(arrival);
  const hasLiveVehicle = arrival.source === "live" && arrival.vehicleId !== undefined;
  const actionLabel = hasLiveVehicle ? t("arrival.viewLive") : t("arrival.viewTrip");

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      disabled={!onPress}
      onPress={() => onPress?.(arrival)}
      accessibilityRole="button"
      accessibilityLabel={`${arrival.routeShortName} ${arrival.headsign}`}
      accessibilityHint={actionLabel}
    >
      <View style={styles.time}>
        <Text
          style={[
            styles.primary,
            { color: statusTimeColors[status.status] },
            time.struck && styles.struck,
          ]}
        >
          {time.primary}
        </Text>
        {time.unit ? <Text style={styles.unit}>{time.unit}</Text> : null}
      </View>
      <RouteBadge
        label={arrival.routeShortName}
        color={arrival.routeColor}
        textColor={arrival.routeTextColor}
      />
      <View style={styles.details}>
        <Text style={styles.headsign} numberOfLines={2}>
          {arrival.headsign}
        </Text>
        <StatusChip status={status.status} label={t(status.key, status.params)} />
        {onPress ? <Text style={styles.action}>{actionLabel}</Text> : null}
      </View>
      {onPress ? <ChevronIcon /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  pressed: {
    backgroundColor: colors.map,
  },
  time: {
    width: 72,
  },
  primary: {
    fontFamily: monospaceFont,
    fontSize: fontSizes.bigTime,
    fontWeight: "700",
  },
  struck: {
    textDecorationLine: "line-through",
  },
  unit: {
    color: colors.muted,
    fontFamily: monospaceFont,
    fontSize: 13,
  },
  details: {
    flex: 1,
    gap: spacing.xs,
  },
  headsign: {
    color: colors.inkSecondary,
    fontSize: fontSizes.body,
  },
  action: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});
