import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { StyleProp, ViewStyle } from "react-native";
import { BackHandler, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { ActionButton } from "@/shared/components/ActionButton";
import { RouteBadge } from "@/shared/components/RouteBadge";
import { colors, radii, spacing } from "@/shared/theme";
import type { MapLayers } from "./map-layers";
import type { RouteFilter } from "./route-filter";

interface LayersCardProps {
  visible: boolean;
  layers: MapLayers;
  routeFilter: RouteFilter;
  style?: StyleProp<ViewStyle>;
  onClose: () => void;
  onChangeShowVehicles: (value: boolean) => void;
  onChangeShowStops: (value: boolean) => void;
  onChangeFilterEnabled: (value: boolean) => void;
  onRemoveRoute: (routeId: string) => void;
  onAddRoutes: () => void;
}

/**
 * Small card with the layer switches and the route filter ("only my buses"). Closes on a tap
 * outside it and on Android back (consuming that back press so the panel stack underneath does
 * not also react to it).
 */
export function LayersCard({
  visible,
  layers,
  routeFilter,
  style,
  onClose,
  onChangeShowVehicles,
  onChangeShowStops,
  onChangeFilterEnabled,
  onRemoveRoute,
  onAddRoutes,
}: LayersCardProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [visible, onClose]);

  if (!visible) return null;

  const hasRoutes = routeFilter.routes.length > 0;

  return (
    <>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <View style={[styles.card, style]}>
        <Text style={styles.title}>{t("map.layers.title")}</Text>
        <Row
          label={t("map.layers.vehicles")}
          value={layers.showVehicles}
          onValueChange={onChangeShowVehicles}
        />
        <Row
          label={t("map.layers.stops")}
          value={layers.showStops}
          onValueChange={onChangeShowStops}
        />

        <View style={styles.section}>
          <Text style={styles.title}>{t("map.layers.routes.title")}</Text>
          <Row
            label={t("map.layers.routes.filterSwitch")}
            value={routeFilter.enabled}
            disabled={!hasRoutes}
            onValueChange={onChangeFilterEnabled}
          />
          {hasRoutes ? (
            <View style={styles.badges}>
              {routeFilter.routes.map((route) => (
                <Pressable
                  key={route.id}
                  onPress={() => onRemoveRoute(route.id)}
                  accessibilityRole="button"
                  accessibilityLabel={t("map.layers.routes.remove", { name: route.shortName })}
                  style={styles.badgeButton}
                >
                  <RouteBadge
                    label={route.shortName}
                    color={route.color}
                    textColor={route.textColor}
                  />
                  <Text style={styles.removeMark}>✕</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>{t("map.layers.routes.empty")}</Text>
          )}
          <ActionButton label={t("map.layers.routes.add")} onPress={onAddRoutes} />
        </View>
      </View>
    </>
  );
}

function Row({
  label,
  value,
  disabled,
  onValueChange,
}: {
  label: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    gap: spacing.md,
    minWidth: 240,
    maxWidth: 340,
    padding: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    elevation: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  section: {
    gap: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    color: colors.ink,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  badgeButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  removeMark: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
  },
});
