import type { StopTimetableResponse } from "@transit/contracts";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
import { PanelHeader } from "@/shared/components/PanelHeader";
import { EmptyState, ErrorState, LoadingState } from "@/shared/components/PanelStatus";
import { SheetFlatList } from "@/shared/components/SheetLists";
import { stepServiceDate } from "@/shared/format/timetable";
import { colors, spacing } from "@/shared/theme";
import { useClockSelect } from "@/shared/time/use-clock-select";
import { DaySelector } from "./DaySelector";
import { TimetableRowView } from "./TimetableRowView";
import { buildTimetableRows, type TimetableRow } from "./timetable-rows";
import type { TimetableDays } from "./use-timetable-view";

interface TimetablePanelProps {
  /** The response for the selected day; `undefined` while it loads or failed. */
  data: StopTimetableResponse | undefined;
  /** Stop and selectable days, kept while another day loads. */
  days: TimetableDays | undefined;
  error: unknown;
  isLoading: boolean;
  /** The day being requested; undefined = the server default (today). */
  selectedDate: string | undefined;
  onSelectDate: (date: string) => void;
  onClose: () => void;
  onRetry: () => void;
}

/** Horizontal travel (dp) that starts a day swipe, the vertical travel that cancels it, and the distance that commits it. */
const SWIPE_ACTIVE_OFFSET = 24;
const SWIPE_FAIL_OFFSET = 12;
const SWIPE_MIN_DISTANCE = 60;
const SECONDS_PER_MINUTE = 60;

/** Full-day scheduled timetable of a stop: scheduled data only, no live information. */
export function TimetablePanel({
  data,
  days,
  error,
  isLoading,
  selectedDate,
  onSelectDate,
  onClose,
  onRetry,
}: TimetablePanelProps) {
  const { t } = useTranslation();
  // Rows change with the minute, not with every second: the next departure and the passed ones
  // only move when a minute ends. The countdown ticks inside its own box.
  const nowMinute = useClockSelect(
    (now) => Math.floor(now / SECONDS_PER_MINUTE) * SECONDS_PER_MINUTE,
  );
  const [expandedGroups, setExpandedGroups] = useState<ReadonlySet<string>>(() => new Set());
  const toggleGroup = useCallback((groupKey: string) => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (!next.delete(groupKey)) next.add(groupKey);
      return next;
    });
  }, []);

  // Swipe left = next day, right = previous; nothing happens at the ends of the catalog.
  const availableDates = days?.availableDates;
  const currentDate = selectedDate ?? data?.serviceDate ?? days?.today;
  const changeDay = useCallback(
    (direction: "next" | "previous") => {
      if (availableDates === undefined || currentDate === undefined) return;
      const target = stepServiceDate(availableDates, currentDate, direction);
      if (target !== undefined) onSelectDate(target);
    },
    [availableDates, currentDate, onSelectDate],
  );
  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-SWIPE_ACTIVE_OFFSET, SWIPE_ACTIVE_OFFSET])
        .failOffsetY([-SWIPE_FAIL_OFFSET, SWIPE_FAIL_OFFSET])
        .onEnd((event) => {
          if (Math.abs(event.translationX) <= SWIPE_MIN_DISTANCE) return;
          scheduleOnRN(changeDay, event.translationX < 0 ? "next" : "previous");
        }),
    [changeDay],
  );

  const isToday = data !== undefined && data.serviceDate === data.today;
  const rows = useMemo(
    () =>
      data === undefined
        ? []
        : buildTimetableRows({
            groups: data.groups,
            now: nowMinute,
            isToday,
            expanded: expandedGroups,
          }),
    [data, nowMinute, isToday, expandedGroups],
  );
  const renderRow = useCallback(
    ({ item }: { item: TimetableRow }) => (
      <TimetableRowView row={item} onToggleGroup={toggleGroup} />
    ),
    [toggleGroup],
  );

  // First load (no stop info yet): only the loading or error state.
  if (days === undefined) {
    return (
      <View style={styles.container}>
        <PanelHeader title={null} onClose={onClose} />
        {error !== undefined ? (
          <ErrorState onRetry={onRetry} />
        ) : isLoading ? (
          <LoadingState />
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PanelHeader
        title={days.stop.name}
        subtitle={t("timetable.subtitle", { code: days.stop.code })}
        onClose={onClose}
      />

      <DaySelector
        availableDates={days.availableDates}
        today={days.today}
        selectedDate={selectedDate ?? data?.serviceDate ?? days.today}
        onSelect={onSelectDate}
      />

      <GestureDetector gesture={swipeGesture}>
        <View style={styles.swipeArea} collapsable={false}>
          {data !== undefined ? (
            <SheetFlatList
              data={rows}
              keyExtractor={(row) => row.key}
              renderItem={renderRow}
              initialNumToRender={14}
              ListEmptyComponent={
                <EmptyState title={t("timetable.empty")} hint={t("timetable.emptyHint")} />
              }
              ListFooterComponent={<Text style={styles.note}>{t("timetable.note")}</Text>}
              contentContainerStyle={styles.list}
            />
          ) : error !== undefined ? (
            <ErrorState onRetry={onRetry} />
          ) : isLoading ? (
            <LoadingState />
          ) : null}
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  swipeArea: {
    flex: 1,
  },
  list: {
    paddingBottom: spacing.xl,
  },
  note: {
    marginTop: spacing.md,
    color: colors.muted,
    fontSize: 13,
  },
});
