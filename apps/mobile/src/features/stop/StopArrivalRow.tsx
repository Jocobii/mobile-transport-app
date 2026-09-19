import type { ArrivalDto } from "@transit/contracts";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { RouteBadge } from "@/shared/components/RouteBadge";
import { StatusChip } from "@/shared/components/StatusChip";
import { formatArrivalStatus } from "@/shared/format/arrival-status";
import { formatArrivalTime } from "@/shared/format/arrival-time";
import { colors, fontSizes, monospaceFont, spacing, statusTimeColors } from "@/shared/theme";

interface StopArrivalRowProps {
  arrival: ArrivalDto;
  now: number;
}

/** Arrival line of the stop panel: the time is the biggest element. */
export function StopArrivalRow({ arrival, now }: StopArrivalRowProps) {
  const { t } = useTranslation();
  const time = formatArrivalTime(arrival, now, {
    now: t("arrival.now"),
    minutesUnit: t("arrival.minutes"),
  });
  const status = formatArrivalStatus(arrival);

  return (
    <View style={styles.row}>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
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
    color: colors.muted,
  },
  unit: {
    color: colors.muted,
    fontFamily: monospaceFont,
    fontSize: 13,
  },
  details: {
    flex: 1,
    gap: 2,
  },
  headsign: {
    color: colors.inkSecondary,
    fontSize: fontSizes.body,
  },
});
