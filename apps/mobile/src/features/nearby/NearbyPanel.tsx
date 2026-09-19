import type { NearbyStopsResponse } from "@transit/contracts";
import { useTranslation } from "react-i18next";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { FreshnessLabel } from "@/shared/components/FreshnessLabel";
import { EmptyState, ErrorState, LoadingState } from "@/shared/components/PanelStatus";
import { colors, fontSizes, spacing } from "@/shared/theme";
import { useNow } from "@/shared/time/use-now";
import { NearbyStopCard } from "./NearbyStopCard";

interface NearbyPanelProps {
  data: NearbyStopsResponse | undefined;
  error: unknown;
  isInitialLoading: boolean;
  lastSuccessAt: number | undefined;
  locationUnavailable: boolean;
  onStopPress: (stopId: string) => void;
  onRetry: () => void;
}

export function NearbyPanel({
  data,
  error,
  isInitialLoading,
  lastSuccessAt,
  locationUnavailable,
  onStopPress,
  onRetry,
}: NearbyPanelProps) {
  const { t } = useTranslation();
  const now = useNow();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("nearby.title")}</Text>
        <FreshnessLabel lastSuccessAt={lastSuccessAt} now={now} />
      </View>
      <Body
        data={data}
        error={error}
        isInitialLoading={isInitialLoading}
        locationUnavailable={locationUnavailable}
        now={now}
        onStopPress={onStopPress}
        onRetry={onRetry}
      />
    </View>
  );
}

interface BodyProps {
  data: NearbyStopsResponse | undefined;
  error: unknown;
  isInitialLoading: boolean;
  locationUnavailable: boolean;
  now: number;
  onStopPress: (stopId: string) => void;
  onRetry: () => void;
}

function Body({
  data,
  error,
  isInitialLoading,
  locationUnavailable,
  now,
  onStopPress,
  onRetry,
}: BodyProps) {
  const { t } = useTranslation();

  if (locationUnavailable) return <EmptyState title={t("nearby.locationDenied")} />;
  if (data) {
    return (
      <FlatList
        data={data.stops}
        keyExtractor={(item) => item.stop.id}
        renderItem={({ item }) => <NearbyStopCard item={item} now={now} onPress={onStopPress} />}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={
          data.outsideRadius ? <Text style={styles.note}>{t("nearby.outsideRadius")}</Text> : null
        }
        ListEmptyComponent={<EmptyState title={t("nearby.empty")} />}
        contentContainerStyle={styles.list}
      />
    );
  }
  if (error !== undefined) return <ErrorState onRetry={onRetry} />;
  if (isInitialLoading) return <LoadingState message={t("nearby.loading")} />;
  return null;
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
  list: {
    paddingBottom: spacing.xl,
  },
  note: {
    color: colors.muted,
    fontSize: fontSizes.body,
    marginBottom: spacing.md,
  },
  separator: {
    height: spacing.md,
  },
});
