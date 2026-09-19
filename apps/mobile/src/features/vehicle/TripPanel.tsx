import type { ArrivalDto } from "@transit/contracts";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { ActionButton } from "@/shared/components/ActionButton";
import { RouteBadge } from "@/shared/components/RouteBadge";
import { StatusChip } from "@/shared/components/StatusChip";
import { formatArrivalStatus } from "@/shared/format/arrival-status";
import { formatArrivalTime } from "@/shared/format/arrival-time";
import { colors, fontSizes, monospaceFont, spacing, statusTimeColors } from "@/shared/theme";
import { useNow } from "@/shared/time/use-now";

interface TripPanelProps {
  arrival: ArrivalDto;
  onSeeStopArrivals: () => void;
}

/** Trip without a live vehicle to follow (scheduled or unlocated): time, status and a way out. */
export function TripPanel({ arrival, onSeeStopArrivals }: TripPanelProps) {
  const { t } = useTranslation();
  const now = useNow();
  const time = formatArrivalTime(arrival, now, {
    now: t("arrival.now"),
    minutesUnit: t("arrival.minutes"),
  });
  const status = formatArrivalStatus(arrival);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <RouteBadge
          label={arrival.routeShortName}
          color={arrival.routeColor}
          textColor={arrival.routeTextColor}
        />
        <Text style={styles.headsign} numberOfLines={2}>
          {t("vehicle.destination", { headsign: arrival.headsign })}
        </Text>
      </View>
      <Text
        style={[
          styles.time,
          { color: statusTimeColors[status.status] },
          time.struck && styles.struck,
        ]}
      >
        {`${time.primary} ${time.unit}`.trim()}
      </Text>
      <StatusChip status={status.status} label={t(status.key, status.params)} />
      <Text style={styles.note}>{t("vehicle.noLivePosition")}</Text>
      <ActionButton label={t("vehicle.seeStopArrivals")} onPress={onSeeStopArrivals} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  headsign: {
    flex: 1,
    color: colors.ink,
    fontSize: fontSizes.title,
    fontWeight: "700",
  },
  time: {
    fontFamily: monospaceFont,
    fontSize: 32,
    fontWeight: "700",
  },
  struck: {
    textDecorationLine: "line-through",
  },
  note: {
    color: colors.inkSecondary,
    fontSize: fontSizes.body,
  },
});
