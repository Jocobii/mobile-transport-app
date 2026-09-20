import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { ActionButton } from "@/shared/components/ActionButton";
import { RouteBadge } from "@/shared/components/RouteBadge";
import { formatClockTime, formatServiceDayLabel } from "@/shared/format/timetable";
import { colors, fontSizes, spacing } from "@/shared/theme";
import { useNow } from "@/shared/time/use-now";
import { summarizeEmptyStop } from "./next-scheduled-departure";
import type { NextScheduledDeparture } from "./use-next-scheduled-departure";

interface EmptyStopInfoProps {
  nextDeparture: NextScheduledDeparture;
  onOpenTimetable: () => void;
}

/** A stop without arrivals: says so, then shows what the schedule knows (EPIC-008 §4.7). */
export function EmptyStopInfo({ nextDeparture, onOpenTimetable }: EmptyStopInfoProps) {
  const { t } = useTranslation();
  const now = useNow();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("stop.emptyTitle")}</Text>
      {nextDeparture.status === "ready" ? (
        <ScheduleInfo responses={nextDeparture.responses} now={now} />
      ) : null}
      {nextDeparture.status === "ready" ? (
        <ActionButton label={t("stop.openTimetable")} onPress={onOpenTimetable} />
      ) : null}
    </View>
  );
}

function ScheduleInfo({
  responses,
  now,
}: {
  responses: Parameters<typeof summarizeEmptyStop>[0];
  now: number;
}) {
  const { t } = useTranslation();
  const { next, routes } = summarizeEmptyStop(responses, now);

  const weekdays = t("timetable.weekdays", { returnObjects: true });
  const dayLabels = {
    today: t("timetable.today").toLowerCase(),
    tomorrow: t("timetable.tomorrow").toLowerCase(),
    weekdays: Array.isArray(weekdays) ? weekdays.map(String) : [],
  };
  const clock = next ? formatClockTime(next.time) : undefined;
  const time = clock
    ? t("timetable.clock", {
        time: clock.text,
        period: t(clock.period === "am" ? "timetable.am" : "timetable.pm"),
      })
    : undefined;

  return (
    <>
      {next && time ? (
        <View style={styles.block}>
          <Text style={styles.body}>{t("stop.nextScheduled", { time })}</Text>
          <View style={styles.badgeRow}>
            <Text style={styles.body}>
              {formatServiceDayLabel(next.serviceDate, next.feedToday, dayLabels)}
            </Text>
            <RouteBadge
              label={next.route.routeShortName}
              color={next.route.routeColor}
              textColor={next.route.routeTextColor}
            />
          </View>
        </View>
      ) : (
        <Text style={styles.body}>{t("stop.noUpcomingService")}</Text>
      )}
      {routes.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.label}>{t("stop.servedBy")}</Text>
          <View style={styles.badgeRow}>
            {routes.map((route) => (
              <RouteBadge
                key={route.routeId}
                label={route.routeShortName}
                color={route.routeColor}
                textColor={route.routeTextColor}
              />
            ))}
          </View>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  title: {
    color: colors.ink,
    fontSize: fontSizes.title,
    fontWeight: "700",
  },
  block: {
    gap: spacing.sm,
  },
  body: {
    color: colors.inkSecondary,
    fontSize: fontSizes.body,
  },
  label: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
  },
});
