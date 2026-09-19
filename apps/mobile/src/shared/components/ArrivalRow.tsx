import type { ArrivalDto } from "@transit/contracts";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { formatArrivalStatus } from "@/shared/format/arrival-status";
import { formatArrivalTime } from "@/shared/format/arrival-time";
import {
  colors,
  fontSizes,
  monospaceFont,
  spacing,
  statusColors,
  statusTimeColors,
} from "@/shared/theme";
import { RouteBadge } from "./RouteBadge";

interface ArrivalRowProps {
  arrival: ArrivalDto;
  now: number;
}

/** Compact arrival line used in the nearby stop cards. */
export function ArrivalRow({ arrival, now }: ArrivalRowProps) {
  const { t } = useTranslation();
  const time = formatArrivalTime(arrival, now, {
    now: t("arrival.now"),
    minutesUnit: t("arrival.minutes"),
  });
  const status = formatArrivalStatus(arrival);
  const isProblem = status.status === "problem";

  return (
    <View style={styles.row}>
      <RouteBadge
        label={arrival.routeShortName}
        color={arrival.routeColor}
        textColor={arrival.routeTextColor}
      />
      <View style={styles.details}>
        <Text style={styles.headsign} numberOfLines={1}>
          {arrival.headsign}
        </Text>
        {isProblem ? (
          <Text style={styles.problem} numberOfLines={1}>
            {t(status.key)}
          </Text>
        ) : null}
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
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  details: {
    flex: 1,
  },
  headsign: {
    color: colors.inkSecondary,
    fontSize: fontSizes.body,
  },
  problem: {
    color: statusColors.problem.fg,
    fontSize: 13,
  },
  time: {
    minWidth: 64,
    textAlign: "right",
    fontFamily: monospaceFont,
    fontSize: fontSizes.body,
    fontWeight: "700",
  },
  struck: {
    textDecorationLine: "line-through",
    color: colors.muted,
  },
});
