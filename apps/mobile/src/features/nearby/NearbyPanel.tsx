import type { NearbyStopsResponse } from "@transit/contracts";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { FreshnessLabel } from "@/shared/components/FreshnessLabel";
import { PanelHeader } from "@/shared/components/PanelHeader";
import { EmptyState, ErrorState, LoadingState } from "@/shared/components/PanelStatus";
import { SheetFlatList } from "@/shared/components/SheetLists";
import { formatDistance } from "@/shared/format/distance";
import { colors, fontSizes, spacing } from "@/shared/theme";
import { groupNearbyByRoute, type NearbyRouteGroup } from "./group-nearby-by-route";
import { NearbyRouteRow } from "./NearbyRouteRow";
import { nearbyEmptyKey } from "./nearby-empty";

const RADIUS_ROUNDING_METERS = 100;

interface NearbyPanelProps {
  data: NearbyStopsResponse | undefined;
  error: unknown;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  lastSuccessAt: number | undefined;
  locationUnavailable: boolean;
  highlightedStopId: string | undefined;
  /** The route filter is on: an empty list points at it. */
  routeFilterActive: boolean;
  onRoutePress: (group: NearbyRouteGroup) => void;
  onRetry: () => void;
}

export function NearbyPanel({
  data,
  error,
  isInitialLoading,
  isRefreshing,
  lastSuccessAt,
  locationUnavailable,
  highlightedStopId,
  routeFilterActive,
  onRoutePress,
  onRetry,
}: NearbyPanelProps) {
  const { t } = useTranslation();
  const groups = useMemo(() => (data ? groupNearbyByRoute(data) : []), [data]);

  return (
    <View style={styles.container}>
      <PanelHeader
        title={t("nearby.title")}
        subtitle={groups.length > 0 ? <Subtitle groups={groups} /> : undefined}
      />
      <View style={styles.header}>
        <FreshnessLabel
          lastSuccessAt={lastSuccessAt}
          onRefresh={onRetry}
          refreshing={isRefreshing}
        />
      </View>
      <Body
        data={data}
        groups={groups}
        error={error}
        isInitialLoading={isInitialLoading}
        locationUnavailable={locationUnavailable}
        highlightedStopId={highlightedStopId}
        routeFilterActive={routeFilterActive}
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
  highlightedStopId: string | undefined;
  routeFilterActive: boolean;
  onRoutePress: (group: NearbyRouteGroup) => void;
  onRetry: () => void;
}

function Body({
  data,
  groups,
  error,
  isInitialLoading,
  locationUnavailable,
  highlightedStopId,
  routeFilterActive,
  onRoutePress,
  onRetry,
}: BodyProps) {
  const { t } = useTranslation();

  if (locationUnavailable) return <EmptyState title={t("nearby.locationDenied")} />;
  if (data) {
    const emptyKey = nearbyEmptyKey(data.stops.length, routeFilterActive);
    return (
      <SheetFlatList
        data={groups}
        keyExtractor={(group) => group.key}
        renderItem={({ item }) => (
          <NearbyRouteRow
            group={item}
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
            title={t(`nearby.${emptyKey}`)}
            hint={routeFilterActive ? t("nearby.emptyFilteredHint") : undefined}
          />
        }
        contentContainerStyle={styles.list}
      />
    );
  }
  if (error !== undefined) return <ErrorState error={error} onRetry={onRetry} />;
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
