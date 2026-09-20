import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronIcon } from "@/shared/components/icons/ChevronIcon";
import { RouteBadge } from "@/shared/components/RouteBadge";
import { StatusChip } from "@/shared/components/StatusChip";
import { formatArrivalStatus } from "@/shared/format/arrival-status";
import { type ArrivalTimeText, formatArrivalTime } from "@/shared/format/arrival-time";
import { formatDistance } from "@/shared/format/distance";
import { colors, fontSizes, monospaceFont, radii, spacing, statusTimeColors } from "@/shared/theme";
import { shallowEqual, useClockSelect } from "@/shared/time/use-clock-select";
import type { NearbyRouteGroup } from "./group-nearby-by-route";

interface NearbyRouteRowProps {
  group: NearbyRouteGroup;
  highlighted: boolean;
  onPress: (group: NearbyRouteGroup) => void;
}

function sameText(a: ArrivalTimeText | undefined, b: ArrivalTimeText | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return shallowEqual(a, b);
}

/** One route + destination: full destination, status, boarding stop and the next two times. */
export function NearbyRouteRow({ group, highlighted, onPress }: NearbyRouteRowProps) {
  const { t } = useTranslation();
  const [first, second] = group.arrivals;
  const labels = { now: t("arrival.now"), minutesUnit: t("arrival.minutes") };
  // Re-renders only when a shown time changes (about once a minute), not every second.
  const times = useClockSelect(
    (now) => ({
      time: first ? formatArrivalTime(first, now, labels) : undefined,
      next: second ? formatArrivalTime(second, now, labels) : undefined,
    }),
    (a, b) => sameText(a.time, b.time) && sameText(a.next, b.next),
  );
  if (!first || !times.time) return null;

  const { time, next } = times;
  const status = formatArrivalStatus(first);

  return (
    <Pressable
      onPress={() => onPress(group)}
      accessibilityRole="button"
      accessibilityLabel={t("nearby.rowLabel", {
        route: group.routeShortName,
        headsign: group.headsign,
        stop: group.stop.name,
      })}
      style={({ pressed }) => [
        styles.row,
        highlighted && styles.highlighted,
        pressed && styles.pressed,
      ]}
    >
      <RouteBadge
        label={group.routeShortName}
        color={group.routeColor}
        textColor={group.routeTextColor}
      />
      <View style={styles.details}>
        <Text style={styles.headsign} numberOfLines={2}>
          {t("nearby.destination", { headsign: group.headsign })}
        </Text>
        <StatusChip status={status.status} label={t(status.key, status.params)} />
        <Text style={styles.stop} numberOfLines={1}>
          {t("nearby.boardingStop", {
            stop: group.stop.name,
            distance: formatDistance(group.distanceMeters),
          })}
        </Text>
      </View>
      <View style={styles.times}>
        <Text
          style={[
            styles.time,
            { color: statusTimeColors[status.status] },
            time.struck && styles.struck,
          ]}
        >
          {`${time.primary} ${time.unit}`.trim()}
        </Text>
        {next ? (
          <Text style={styles.next}>
            {t("nearby.then", { time: `${next.primary} ${next.unit}`.trim() })}
          </Text>
        ) : null}
      </View>
      <View style={styles.chevron}>
        <ChevronIcon />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
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
  chevron: {
    alignSelf: "center",
  },
  highlighted: {
    borderColor: colors.ink,
    borderWidth: 2,
  },
  details: {
    flex: 1,
    gap: spacing.xs,
  },
  headsign: {
    color: colors.ink,
    fontSize: fontSizes.body,
    fontWeight: "600",
  },
  stop: {
    color: colors.muted,
    fontSize: 13,
  },
  times: {
    alignItems: "flex-end",
    minWidth: 64,
  },
  time: {
    fontFamily: monospaceFont,
    fontSize: fontSizes.bigTime,
    fontWeight: "700",
  },
  struck: {
    textDecorationLine: "line-through",
  },
  next: {
    color: colors.muted,
    fontSize: 13,
  },
});
