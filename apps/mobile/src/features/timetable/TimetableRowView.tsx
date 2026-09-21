import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronIcon } from "@/shared/components/icons/ChevronIcon";
import { RouteBadge } from "@/shared/components/RouteBadge";
import { routeColors } from "@/shared/format/route-colors";
import { formatClockTime, formatCountdown } from "@/shared/format/timetable";
import { colors, fontSizes, radii, spacing } from "@/shared/theme";
import { useClockSelect } from "@/shared/time/use-clock-select";
import { type RowEdge, TIMES_PER_ROW, type TimetableRow } from "./timetable-rows";

interface TimetableRowViewProps {
  row: TimetableRow;
  onToggleGroup: (groupKey: string) => void;
}

/** Clock text with the am/pm words from i18n ("6:23 a. m."). */
function useClock(): (time: number) => string {
  const { t } = useTranslation();
  return (time) => {
    const { text, period } = formatClockTime(time);
    return t("timetable.clock", {
      time: text,
      period: t(period === "am" ? "timetable.am" : "timetable.pm"),
    });
  };
}

/** Draws one slice of a group's card; the borders and padding depend on where the slice sits. */
function CardRow({ edge, children }: { edge: RowEdge; children: ReactNode }) {
  const top = edge === "first" || edge === "only";
  const bottom = edge === "last" || edge === "only";
  return (
    <View style={[styles.card, top ? styles.cardTop : styles.rowGap, bottom && styles.cardBottom]}>
      {children}
    </View>
  );
}

/**
 * One row of a stop timetable: the pieces of a route + direction card (header, next departure,
 * summary, passed toggle, part-of-day label, four departures). The list virtualizes these rows.
 */
export function TimetableRowView({ row, onToggleGroup }: TimetableRowViewProps) {
  switch (row.kind) {
    case "header":
      return (
        <CardRow edge={row.edge}>
          <View style={styles.header}>
            <RouteBadge
              label={row.group.routeShortName}
              color={row.group.routeColor}
              textColor={row.group.routeTextColor}
            />
            <Text style={styles.headsign} numberOfLines={2}>
              {row.group.headsign}
            </Text>
          </View>
        </CardRow>
      );
    case "next":
      return (
        <CardRow edge={row.edge}>
          <NextBox group={row.group} next={row.next} />
        </CardRow>
      );
    case "summary":
      return (
        <CardRow edge={row.edge}>
          <Summary row={row} />
        </CardRow>
      );
    case "toggle":
      return (
        <CardRow edge={row.edge}>
          <PassedToggle row={row} onToggleGroup={onToggleGroup} />
        </CardRow>
      );
    case "sectionLabel":
      return (
        <CardRow edge={row.edge}>
          <SectionLabel part={row.part} />
        </CardRow>
      );
    case "times":
      return (
        <CardRow edge={row.edge}>
          <TimesGrid row={row} />
        </CardRow>
      );
  }
}

function NextBox({
  group,
  next,
}: {
  group: Extract<TimetableRow, { kind: "next" }>["group"];
  next: number | undefined;
}) {
  const { t } = useTranslation();
  const clock = useClock();
  const palette = routeColors(group.routeColor, group.routeTextColor);
  // Ticks on its own: only this box re-renders when the countdown changes.
  const countdown = useClockSelect(
    (now) => (next === undefined ? undefined : formatCountdown(next - now)),
    (a, b) => a?.key === b?.key && JSON.stringify(a?.params) === JSON.stringify(b?.params),
  );

  return (
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
  );
}

function Summary({ row }: { row: Extract<TimetableRow, { kind: "summary" }> }) {
  const { t } = useTranslation();
  const clock = useClock();
  const countLine = [
    t("timetable.departures", { count: row.count }),
    row.headwayMinutes !== undefined
      ? t("timetable.headway", { minutes: row.headwayMinutes })
      : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View>
      <Text style={styles.meta}>{countLine}</Text>
      {row.first !== undefined && row.last !== undefined ? (
        <Text style={styles.meta}>
          {t("timetable.firstLast", { first: clock(row.first), last: clock(row.last) })}
        </Text>
      ) : null}
    </View>
  );
}

function PassedToggle({
  row,
  onToggleGroup,
}: {
  row: Extract<TimetableRow, { kind: "toggle" }>;
  onToggleGroup: (groupKey: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={() => onToggleGroup(row.groupKey)}
      accessibilityRole="button"
      accessibilityState={{ expanded: row.expanded }}
      style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}
    >
      <Text style={styles.toggleText}>
        {row.expanded
          ? t("timetable.hidePassed")
          : t("timetable.showPassed", { count: row.passedCount })}
      </Text>
      <View style={row.expanded ? styles.chevronUp : styles.chevronDown}>
        <ChevronIcon size={16} color={colors.inkSecondary} />
      </View>
    </Pressable>
  );
}

function SectionLabel({ part }: { part: Extract<TimetableRow, { kind: "sectionLabel" }>["part"] }) {
  const { t } = useTranslation();
  return <Text style={styles.sectionLabel}>{t(`timetable.parts.${part}`).toUpperCase()}</Text>;
}

function TimesGrid({ row }: { row: Extract<TimetableRow, { kind: "times" }> }) {
  const { t } = useTranslation();
  const clock = useClock();
  const palette = routeColors(row.group.routeColor, row.group.routeTextColor);
  const empty = Array.from({ length: TIMES_PER_ROW - row.times.length });

  return (
    <View style={styles.grid}>
      {row.times.map((time) => {
        const isNext = time === row.next;
        const isPassed = row.passedBefore !== undefined && time < row.passedBefore;
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
      {empty.map((_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-size filler cells, never reordered
        <View key={`filler-${index}`} style={styles.cell} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: spacing.lg,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  cardTop: {
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopLeftRadius: radii.card,
    borderTopRightRadius: radii.card,
  },
  cardBottom: {
    marginBottom: spacing.sm,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomLeftRadius: radii.card,
    borderBottomRightRadius: radii.card,
  },
  rowGap: {
    paddingTop: spacing.md,
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
  sectionLabel: {
    paddingBottom: spacing.xs,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  grid: {
    flexDirection: "row",
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
