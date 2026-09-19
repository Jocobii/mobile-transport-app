import type { ArrivalDto } from "@transit/contracts";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { LiveIcon } from "@/shared/components/LiveIcon";
import { RouteBadge } from "@/shared/components/RouteBadge";
import { formatArrivalStatus } from "@/shared/format/arrival-status";
import { formatArrivalTime } from "@/shared/format/arrival-time";
import { colors, fontSizes, monospaceFont, spacing } from "@/shared/theme";

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
        <Text style={[styles.primary, time.struck && styles.struck]}>{time.primary}</Text>
        {time.unit ? <Text style={styles.unit}>{time.unit}</Text> : null}
      </View>
      <RouteBadge label={arrival.routeShortName} />
      <View style={styles.details}>
        <Text style={styles.headsign} numberOfLines={1}>
          {arrival.headsign}
        </Text>
        <View style={styles.statusLine}>
          {status.tone === "live" ? <LiveIcon /> : null}
          <Text style={[styles.status, toneStyles[status.tone]]} numberOfLines={1}>
            {t(status.key, status.params)}
          </Text>
        </View>
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
    color: colors.ink,
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
  statusLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  status: {
    fontSize: 13,
  },
});

const toneStyles = StyleSheet.create({
  live: { color: colors.live },
  scheduled: { color: colors.muted },
  problem: { color: colors.problem },
});
