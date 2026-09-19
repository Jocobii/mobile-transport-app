import type { TimetableGroupDto } from "@transit/contracts";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { RouteBadge } from "@/shared/components/RouteBadge";
import { routeColors } from "@/shared/format/route-colors";
import { findNextDeparture, groupTimesByHour } from "@/shared/format/timetable";
import { colors, fontSizes, monospaceFont, radii, spacing } from "@/shared/theme";

interface TimetableGroupViewProps {
  group: TimetableGroupDto;
  /** Epoch seconds; passed times are dimmed and the next one is filled. Only used when `isToday`. */
  now: number;
  isToday: boolean;
}

/** One route + direction: header, then one row per hour (hour label + minutes), like the paper sheet. */
export function TimetableGroupView({ group, now, isToday }: TimetableGroupViewProps) {
  const { t } = useTranslation();
  const rows = useMemo(() => groupTimesByHour(group.times), [group.times]);
  const palette = routeColors(group.routeColor, group.routeTextColor);
  const next = isToday ? findNextDeparture(group.times, now) : undefined;

  return (
    <View style={styles.group}>
      <View style={styles.header}>
        <RouteBadge
          label={group.routeShortName}
          color={group.routeColor}
          textColor={group.routeTextColor}
        />
        <Text style={styles.headsign} numberOfLines={2}>
          {group.headsign}
        </Text>
      </View>

      {rows.map((row) => {
        const hourLabel = t("timetable.hour", {
          hour: row.hour12,
          period: t(row.period === "am" ? "timetable.am" : "timetable.pm"),
        });
        return (
          <View
            key={row.key}
            style={styles.hourRow}
            accessible
            accessibilityLabel={`${hourLabel}: ${row.minutes.map((minute) => minute.text).join(", ")}`}
          >
            <Text style={styles.hourLabel}>{hourLabel}</Text>
            <View style={styles.minutes}>
              {row.minutes.map((minute) => {
                const isNext = minute.time === next;
                const isPassed = isToday && minute.time < now;
                return (
                  <View
                    key={minute.time}
                    style={[styles.minute, isNext && { backgroundColor: palette.background }]}
                  >
                    <Text
                      style={[
                        styles.minuteText,
                        isPassed && styles.passed,
                        isNext && { color: palette.text, fontWeight: "700" },
                      ]}
                    >
                      {minute.text}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingBottom: spacing.xs,
  },
  headsign: {
    flex: 1,
    color: colors.ink,
    fontSize: fontSizes.body,
    fontWeight: "600",
  },
  hourRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  hourLabel: {
    width: 64,
    paddingVertical: spacing.xs,
    color: colors.muted,
    fontFamily: monospaceFont,
    fontSize: 13,
  },
  minutes: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  minute: {
    minWidth: 40,
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.badge,
  },
  minuteText: {
    color: colors.ink,
    fontFamily: monospaceFont,
    fontSize: fontSizes.body,
  },
  passed: {
    color: colors.muted,
    opacity: 0.5,
  },
});
