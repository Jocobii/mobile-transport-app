import type { StopTimetableResponse } from "@transit/contracts";
import { useTranslation } from "react-i18next";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { EmptyState, ErrorState, LoadingState } from "@/shared/components/PanelStatus";
import { colors, fontSizes, spacing } from "@/shared/theme";
import { useNow } from "@/shared/time/use-now";
import { DaySelector } from "./DaySelector";
import { TimetableGroupView } from "./TimetableGroupView";
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
  onRetry: () => void;
}

/** Full-day scheduled timetable of a stop: scheduled data only, no live information. */
export function TimetablePanel({
  data,
  days,
  error,
  isLoading,
  selectedDate,
  onSelectDate,
  onRetry,
}: TimetablePanelProps) {
  const { t } = useTranslation();
  const now = useNow();

  // First load (no stop info yet): only the loading or error state.
  if (days === undefined) {
    return (
      <View style={styles.container}>
        {error !== undefined ? (
          <ErrorState onRetry={onRetry} />
        ) : isLoading ? (
          <LoadingState />
        ) : null}
      </View>
    );
  }

  const isToday = data !== undefined && data.serviceDate === data.today;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={2}>
          {days.stop.name}
        </Text>
        <Text style={styles.subtitle}>{t("timetable.subtitle", { code: days.stop.code })}</Text>
      </View>

      <DaySelector
        availableDates={days.availableDates}
        today={days.today}
        selectedDate={selectedDate ?? data?.serviceDate ?? days.today}
        onSelect={onSelectDate}
      />

      {data !== undefined ? (
        <FlatList
          data={data.groups}
          keyExtractor={(group) => `${group.routeId}:${group.directionId}:${group.headsign}`}
          renderItem={({ item }) => <TimetableGroupView group={item} now={now} isToday={isToday} />}
          ItemSeparatorComponent={Separator}
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
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.ink,
    fontSize: fontSizes.title,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.inkSecondary,
    fontSize: fontSizes.body,
  },
  separator: {
    height: spacing.sm,
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
