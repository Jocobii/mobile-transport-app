import type { ArrivalDto, StopArrivalsResponse } from "@transit/contracts";
import { useTranslation } from "react-i18next";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { ActionButton } from "@/shared/components/ActionButton";
import { FreshnessLabel } from "@/shared/components/FreshnessLabel";
import { EmptyState, ErrorState, LoadingState } from "@/shared/components/PanelStatus";
import { formatDistance } from "@/shared/format/distance";
import { distanceMeters, type Position } from "@/shared/geo/position";
import { usePullToRefresh } from "@/shared/polling/use-pull-to-refresh";
import { colors, fontSizes, spacing } from "@/shared/theme";
import { useNow } from "@/shared/time/use-now";
import { StopArrivalRow } from "./StopArrivalRow";

interface StopPanelProps {
  data: StopArrivalsResponse | undefined;
  error: unknown;
  isInitialLoading: boolean;
  lastSuccessAt: number | undefined;
  /** Distance is shown only when the user position is known. */
  userPosition: Position | undefined;
  onArrivalPress: (arrival: ArrivalDto) => void;
  onOpenTimetable: () => void;
  onRetry: () => void;
}

export function StopPanel({
  data,
  error,
  isInitialLoading,
  lastSuccessAt,
  userPosition,
  onArrivalPress,
  onOpenTimetable,
  onRetry,
}: StopPanelProps) {
  const { t } = useTranslation();
  const now = useNow();
  const { refreshing, onRefresh } = usePullToRefresh(onRetry, lastSuccessAt);

  return (
    <View style={styles.container}>
      {data ? (
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={2}>
            {data.stop.name}
          </Text>
          <Text style={styles.subtitle}>
            {userPosition
              ? t("stop.codeWithDistance", {
                  code: data.stop.code,
                  distance: formatDistance(distanceMeters(userPosition, data.stop)),
                })
              : t("stop.code", { code: data.stop.code })}
          </Text>
          <FreshnessLabel lastSuccessAt={lastSuccessAt} now={now} />
          <View style={styles.timetableButton}>
            <ActionButton label={t("stop.viewTimetable")} onPress={onOpenTimetable} />
          </View>
          {data.arrivals.length > 0 ? <Text style={styles.hint}>{t("stop.tapHint")}</Text> : null}
        </View>
      ) : null}

      {data ? (
        <FlatList
          data={data.arrivals}
          keyExtractor={(arrival, index) => `${arrival.tripId}:${index}`}
          renderItem={({ item }) => (
            <StopArrivalRow arrival={item} now={now} onPress={onArrivalPress} />
          )}
          ItemSeparatorComponent={Separator}
          ListEmptyComponent={<EmptyState title={t("stop.empty")} hint={t("stop.emptyHint")} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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
  title: {
    color: colors.ink,
    fontSize: fontSizes.title,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.inkSecondary,
    fontSize: fontSizes.body,
  },
  list: {
    paddingBottom: spacing.xl,
  },
});
