import type { ArrivalDto, StopArrivalsResponse } from "@transit/contracts";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { ActionButton } from "@/shared/components/ActionButton";
import { FreshnessLabel } from "@/shared/components/FreshnessLabel";
import { PanelHeader } from "@/shared/components/PanelHeader";
import { ErrorState, LoadingState } from "@/shared/components/PanelStatus";
import { SheetFlatList } from "@/shared/components/SheetLists";
import { formatDistance } from "@/shared/format/distance";
import { distanceMeters, type Position } from "@/shared/geo/position";
import { colors, spacing } from "@/shared/theme";
import { useNow } from "@/shared/time/use-now";
import { EmptyStopInfo } from "./EmptyStopInfo";
import { StopArrivalRow } from "./StopArrivalRow";
import type { NextScheduledDeparture } from "./use-next-scheduled-departure";

interface StopPanelProps {
  data: StopArrivalsResponse | undefined;
  error: unknown;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  lastSuccessAt: number | undefined;
  /** Distance is shown only when the user position is known. */
  userPosition: Position | undefined;
  /** Scheduled fallback shown when there are no arrivals. */
  nextDeparture: NextScheduledDeparture;
  onArrivalPress: (arrival: ArrivalDto) => void;
  onOpenTimetable: () => void;
  onClose: () => void;
  onRetry: () => void;
}

export function StopPanel({
  data,
  error,
  isInitialLoading,
  isRefreshing,
  lastSuccessAt,
  userPosition,
  nextDeparture,
  onArrivalPress,
  onOpenTimetable,
  onClose,
  onRetry,
}: StopPanelProps) {
  const { t } = useTranslation();
  const now = useNow();

  return (
    <View style={styles.container}>
      <PanelHeader
        title={data?.stop.name ?? null}
        subtitle={
          data
            ? userPosition
              ? t("stop.codeWithDistance", {
                  code: data.stop.code,
                  distance: formatDistance(distanceMeters(userPosition, data.stop)),
                })
              : t("stop.code", { code: data.stop.code })
            : undefined
        }
        onClose={onClose}
      />
      {data ? (
        <View style={styles.header}>
          <FreshnessLabel
            lastSuccessAt={lastSuccessAt}
            now={now}
            onRefresh={onRetry}
            refreshing={isRefreshing}
          />
          {data.arrivals.length > 0 ? (
            <View style={styles.timetableButton}>
              <ActionButton label={t("stop.viewTimetable")} onPress={onOpenTimetable} />
            </View>
          ) : null}
          {data.arrivals.length > 0 ? <Text style={styles.hint}>{t("stop.tapHint")}</Text> : null}
        </View>
      ) : null}

      {data ? (
        <SheetFlatList
          data={data.arrivals}
          keyExtractor={(arrival, index) => `${arrival.tripId}:${index}`}
          renderItem={({ item }) => (
            <StopArrivalRow arrival={item} now={now} onPress={onArrivalPress} />
          )}
          ItemSeparatorComponent={Separator}
          ListEmptyComponent={
            <EmptyStopInfo nextDeparture={nextDeparture} onOpenTimetable={onOpenTimetable} />
          }
          contentContainerStyle={styles.list}
        />
      ) : error !== undefined ? (
        <ErrorState onRetry={onRetry} />
      ) : isInitialLoading ? (
        <LoadingState />
      ) : null}
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  timetableButton: {
    marginTop: spacing.sm,
  },
  hint: {
    marginTop: spacing.xs,
    color: colors.inkSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  separator: {
    height: spacing.sm,
  },
  container: {
    flex: 1,
  },
  header: {
    marginBottom: spacing.sm,
  },
  list: {
    paddingBottom: spacing.xl,
  },
});
