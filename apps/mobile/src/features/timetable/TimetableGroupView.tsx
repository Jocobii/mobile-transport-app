import type { TimetableGroupDto } from "@transit/contracts";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronIcon } from "@/shared/components/icons/ChevronIcon";
import { RouteBadge } from "@/shared/components/RouteBadge";
import { routeColors } from "@/shared/format/route-colors";
import {
  findNextDeparture,
  formatClockTime,
  formatCountdown,
  groupTimesByDayPart,
  splitPassedTimes,
  typicalHeadwayMinutes,
} from "@/shared/format/timetable";
import { colors, fontSizes, radii, spacing } from "@/shared/theme";

interface TimetableGroupViewProps {
  group: TimetableGroupDto;
  /** Epoch seconds; only used when `isToday` (next departure, countdown, passed departures). */
  now: number;
  isToday: boolean;
}

/**
 * One route + direction: a summary (next departure with countdown today, count, typical headway,
 * first and last), then full clock times in a grid grouped by part of the day. Today, departures
 * that already left are hidden behind a toggle.
 */
export function TimetableGroupView({ group, now, isToday }: TimetableGroupViewProps) {
  const { t } = useTranslation();
  const [showPassed, setShowPassed] = useState(false);
  const palette = routeColors(group.routeColor, group.routeTextColor);

  const sections = useMemo(() => groupTimesByDayPart(group.times), [group.times]);
  const headway = useMemo(() => typicalHeadwayMinutes(group.times), [group.times]);
  const next = isToday ? findNextDeparture(group.times, now) : undefined;
  const countdown = next !== undefined ? formatCountdown(next - now) : undefined;
  const passed = isToday ? splitPassedTimes(group.times, now).passed : [];
  const hidePassed = isToday && !showPassed;

  const clock = (time: number) => {
    const { text, period } = formatClockTime(time);
    return t("timetable.clock", {
      time: text,
      period: t(period === "am" ? "timetable.am" : "timetable.pm"),
    });
  };

  const first = group.times[0];
  const last = group.times[group.times.length - 1];
  const countLine = [
    t("timetable.departures", { count: group.times.length }),
    headway !== undefined ? t("timetable.headway", { minutes: headway }) : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  const visibleSections = sections
    .map((section) => ({
      part: section.part,
      times: hidePassed ? section.times.filter((time) => time >= now) : section.times,
    }))
    .filter((section) => section.times.length > 0);

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

      {isToday ? (
        <View style={[styles.nextBox, { borderLeftColor: palette.background }]}>
          {next !== undefined && countdown !== undefined ? (
            <>
              <Text style={styles.nextLabel}>{t("timetable.next").toUpperCase()}</Text>
              <View style={styles.nextRow}>
                <Text style={styles.nextTime}>{clock(next)}</Text>
                <Text style={styles.countdown}>
                  {t(`timetable.countdown.${countdown.key}`, countdown.params)}
                </Text>
              </View>
            </>
          ) : (
            <Text style={styles.noMore}>{t("timetable.noMoreToday")}</Text>
          )}
        </View>
      ) : null}

      <View>
        <Text style={styles.meta}>{countLine}</Text>
        {first !== undefined && last !== undefined ? (
          <Text style={styles.meta}>
            {t("timetable.firstLast", { first: clock(first), last: clock(last) })}
          </Text>
        ) : null}
      </View>

      {passed.length > 0 ? (
        <Pressable
          onPress={() => setShowPassed((value) => !value)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showPassed }}
          style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}
        >
          <Text style={styles.toggleText}>
            {showPassed
              ? t("timetable.hidePassed")
              : t("timetable.showPassed", { count: passed.length })}
          </Text>
          <View style={showPassed ? styles.chevronUp : styles.chevronDown}>
            <ChevronIcon size={16} color={colors.inkSecondary} />
          </View>
        </Pressable>
      ) : null}

      {visibleSections.map((section) => (
        <View key={section.part} style={styles.section}>
          <Text style={styles.sectionLabel}>
            {t(`timetable.parts.${section.part}`).toUpperCase()}
          </Text>
          <View style={styles.grid}>
            {section.times.map((time) => {
              const isNext = time === next;
              const isPassed = isToday && time < now;
              return (
                <View
                  key={time}
                  style={styles.cell}
                  accessible
                  accessibilityLabel={
                    isNext ? t("timetable.nextA11y", { time: clock(time) }) : clock(time)
                  }
                >
                  <View
                    style={[
                      styles.pill,
                      isNext && { backgroundColor: palette.background },
                      isPassed && styles.pillPassed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        isPassed && styles.pillTextPassed,
                        isNext && { color: palette.text, fontWeight: "700" },
                      ]}
                    >
                      {formatClockTime(time).text}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    padding: spacing.lg,
    gap: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  headsign: {
    flex: 1,
    color: colors.ink,
    fontSize: fontSizes.body + 1,
    fontWeight: "700",
  },
  nextBox: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    borderLeftWidth: 4,
    backgroundColor: colors.subtle,
  },
  nextLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  nextRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginTop: 2,
  },
  nextTime: {
    color: colors.ink,
    fontSize: fontSizes.bigTime,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  countdown: {
    color: colors.inkSecondary,
    fontSize: fontSizes.body,
    fontWeight: "600",
  },
  noMore: {
    color: colors.inkSecondary,
    fontSize: fontSizes.body,
    fontWeight: "600",
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  toggle: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: radii.badge,
    borderWidth: 1,
    borderColor: colors.line,
  },
  togglePressed: {
    backgroundColor: colors.subtle,
  },
  toggleText: {
    color: colors.inkSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  chevronDown: {
    transform: [{ rotate: "90deg" }],
  },
  chevronUp: {
    transform: [{ rotate: "-90deg" }],
  },
  section: {
    gap: spacing.xs,
  },
  sectionLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -3,
  },
  cell: {
    width: "25%",
    padding: 3,
  },
  pill: {
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.subtle,
  },
  pillPassed: {
    backgroundColor: "transparent",
  },
  pillText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  pillTextPassed: {
    color: colors.muted,
    opacity: 0.6,
  },
});
