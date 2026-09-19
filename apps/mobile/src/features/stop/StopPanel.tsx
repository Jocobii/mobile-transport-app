import type { StopArrivalsResponse } from "@transit/contracts";
import { useTranslation } from "react-i18next";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { FreshnessLabel } from "@/shared/components/FreshnessLabel";
import { EmptyState, ErrorState, LoadingState } from "@/shared/components/PanelStatus";
import { formatDistance } from "@/shared/format/distance";
import { distanceMeters, type Position } from "@/shared/geo/position";
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
  onRetry: () => void;
}

export function StopPanel({
  data,
  error,
  isInitialLoading,
  lastSuccessAt,
  userPosition,
  onRetry,
}: StopPanelProps) {
  const { t } = useTranslation();
  const now = useNow();

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
        </View>
      ) : null}

      {data ? (
        <FlatList
          data={data.arrivals}
          keyExtractor={(arrival, index) => `${arrival.tripId}:${index}`}
          renderItem={({ item }) => <StopArrivalRow arrival={item} now={now} />}
          ListEmptyComponent={<EmptyState title={t("stop.empty")} hint={t("stop.emptyHint")} />}
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
  list: {
    paddingBottom: spacing.xl,
  },
});
