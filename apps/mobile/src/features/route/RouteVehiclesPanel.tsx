import type { RouteSummaryDto, RouteVehiclesResponse, VehicleDto } from "@transit/contracts";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FreshnessLabel } from "@/shared/components/FreshnessLabel";
import { PanelHeader } from "@/shared/components/PanelHeader";
import { EmptyState, ErrorState, LoadingState } from "@/shared/components/PanelStatus";
import { RouteBadge } from "@/shared/components/RouteBadge";
import { SheetFlatList } from "@/shared/components/SheetLists";
import { formatFreshness, secondsSince } from "@/shared/format/freshness";
import { colors, fontSizes, spacing } from "@/shared/theme";
import { useClockSelect } from "@/shared/time/use-clock-select";

interface RouteVehiclesPanelProps {
  route: RouteSummaryDto;
  data: RouteVehiclesResponse | undefined;
  error: unknown;
  isInitialLoading: boolean;
  lastSuccessAt: number | undefined;
  onVehiclePress: (vehicle: VehicleDto) => void;
  onClose: () => void;
  onRetry: () => void;
}

export function RouteVehiclesPanel({
  route,
  data,
  error,
  isInitialLoading,
  lastSuccessAt,
  onVehiclePress,
  onClose,
  onRetry,
}: RouteVehiclesPanelProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <PanelHeader
        title={
          <View style={styles.titleRow}>
            <RouteBadge label={route.shortName} color={route.color} textColor={route.textColor} />
            <Text style={styles.title} numberOfLines={2}>
              {route.longName}
            </Text>
          </View>
        }
        subtitle={
          data ? (
            <Text style={styles.subtitle}>
              {t("route.vehicleCount", { count: data.vehicles.length })}
            </Text>
          ) : undefined
        }
        onClose={onClose}
      />
      <View style={styles.header}>
        <FreshnessLabel lastSuccessAt={lastSuccessAt} />
      </View>

      {data ? (
        <SheetFlatList
          data={data.vehicles}
          keyExtractor={(vehicle) => vehicle.id}
          renderItem={({ item }) => <VehicleRow vehicle={item} onPress={onVehiclePress} />}
          ListEmptyComponent={<EmptyState title={t("route.empty")} />}
          contentContainerStyle={styles.list}
        />
      ) : error !== undefined ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : isInitialLoading ? (
        <LoadingState />
      ) : null}
    </View>
  );
}

function VehicleRow({
  vehicle,
  onPress,
}: {
  vehicle: VehicleDto;
  onPress: (vehicle: VehicleDto) => void;
}) {
  const { t } = useTranslation();
  const age = useClockSelect(
    (now) => formatFreshness(secondsSince(vehicle.updatedAt, now), "inline"),
    (a, b) => a.key === b.key && JSON.stringify(a.params) === JSON.stringify(b.params),
  );
  const destination = vehicle.headsign
    ? t("route.towards", { headsign: vehicle.headsign })
    : t("route.noHeadsign");

  return (
    <Pressable
      onPress={() => onPress(vehicle)}
      accessibilityRole="button"
      accessibilityLabel={destination}
      style={styles.row}
    >
      <Text style={styles.rowTitle} numberOfLines={1}>
        {destination}
      </Text>
      <Text style={styles.rowSubtitle}>{t(age.key, age.params)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  title: {
    flex: 1,
    color: colors.ink,
    fontSize: fontSizes.body,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.inkSecondary,
    fontSize: fontSizes.title,
    fontWeight: "700",
  },
  list: {
    paddingBottom: spacing.xl,
  },
  row: {
    minHeight: 56,
    justifyContent: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowTitle: {
    color: colors.ink,
    fontSize: fontSizes.body,
    fontWeight: "600",
  },
  rowSubtitle: {
    color: colors.muted,
    fontSize: 13,
  },
});
