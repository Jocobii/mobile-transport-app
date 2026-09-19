import type { NearbyStopsResponse } from "@transit/contracts";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { FreshnessLabel } from "@/shared/components/FreshnessLabel";
import { EmptyState, ErrorState, LoadingState } from "@/shared/components/PanelStatus";
import { formatDistance } from "@/shared/format/distance";
import { usePullToRefresh } from "@/shared/polling/use-pull-to-refresh";
import { colors, fontSizes, spacing } from "@/shared/theme";
import { useNow } from "@/shared/time/use-now";
import { groupNearbyByRoute, type NearbyRouteGroup } from "./group-nearby-by-route";
import { NearbyRouteRow } from "./NearbyRouteRow";

const RADIUS_ROUNDING_METERS = 100;

interface NearbyPanelProps {
  data: NearbyStopsResponse | undefined;
  error: unknown;
  isInitialLoading: boolean;
  lastSuccessAt: number | undefined;
  locationUnavailable: boolean;
  highlightedStopId: string | undefined;
  onRoutePress: (group: NearbyRouteGroup) => void;
  onRetry: () => void;
}

export function NearbyPanel({
  data,
  error,
  isInitialLoading,
  lastSuccessAt,
  locationUnavailable,
  highlightedStopId,
  onRoutePress,
  onRetry,
}: NearbyPanelProps) {
  const { t } = useTranslation();
  const now = useNow();
  const groups = useMemo(() => (data ? groupNearbyByRoute(data) : []), [data]);
  const { refreshing, onRefresh } = usePullToRefresh(onRetry, lastSuccessAt);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("nearby.title")}</Text>
        {groups.length > 0 ? <Subtitle groups={groups} /> : null}
        <FreshnessLabel lastSuccessAt={lastSuccessAt} now={now} />
      </View>
      <Body
        data={data}
        groups={groups}
        error={error}
        isInitialLoading={isInitialLoading}
        locationUnavailable={locationUnavailable}
        now={now}
        highlightedStopId={highlightedStopId}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onRoutePress={onRoutePress}
        onRetry={onRetry}
      />
    </View>
  );
}

/** "{routes} rutas · {stops} paradas a menos de {distance}" (plural by routes, context by stops). */
function Subtitle({ groups }: { groups: NearbyRouteGroup[] }) {
  const { t } = useTranslation();
  const routes = new Set(groups.map((group) => group.routeId)).size;
  const stops = new Set(groups.map((group) => group.stop.id)).size;
  const farthest = Math.max(...groups.map((group) => group.distanceMeters));
  const radius = Math.max(
    RADIUS_ROUNDING_METERS,
    Math.ceil(farthest / RADIUS_ROUNDING_METERS) * RADIUS_ROUNDING_METERS,
  );
  return (
    <Text style={styles.subtitle}>
      {t("nearby.subtitle", {
        count: routes,
        stops,
        distance: formatDistance(radius),
        context: stops === 1 ? "singleStop" : "manyStops",
      })}
    </Text>
  );
}

interface BodyProps {
  data: NearbyStopsResponse | undefined;
  groups: NearbyRouteGroup[];
  error: unknown;
  isInitialLoading: boolean;
  locationUnavailable: boolean;
  now: number;
  highlightedStopId: string | undefined;
  refreshing: boolean;
  onRefresh: () => void;
  onRoutePress: (group: NearbyRouteGroup) => void;
  onRetry: () => void;
}

function Body({
  data,
  groups,
  error,
  isInitialLoading,
  locationUnavailable,
  now,
  highlightedStopId,
  refreshing,
  onRefresh,
  onRoutePress,
  onRetry,
}: BodyProps) {
  const { t } = useTranslation();

  if (locationUnavailable) return <EmptyState title={t("nearby.locationDenied")} />;
  if (data) {
    return (
      <FlatList
        data={groups}
        keyExtractor={(group) => group.key}
        renderItem={({ item }) => (
          <NearbyRouteRow
            group={item}
            now={now}
            highlighted={item.stop.id === highlightedStopId}
            onPress={onRoutePress}
          />
        )}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={
          data.outsideRadius ? <Text style={styles.note}>{t("nearby.outsideRadius")}</Text> : null
        }
        ListEmptyComponent={
          <EmptyState
            title={data.stops.length === 0 ? t("nearby.empty") : t("nearby.emptyRoutes")}
          />
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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
  subtitle: {
    color: colors.inkSecondary,
    fontSize: fontSizes.body,
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
