import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { StyleProp, ViewStyle } from "react-native";
import { BackHandler, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { colors, radii, spacing } from "@/shared/theme";
import type { MapLayers } from "./map-layers";

interface LayersCardProps {
  visible: boolean;
  layers: MapLayers;
  style?: StyleProp<ViewStyle>;
  onClose: () => void;
  onChangeShowVehicles: (value: boolean) => void;
  onChangeShowStops: (value: boolean) => void;
}

/**
 * Small card with the two layer switches. Closes on a tap outside it and on Android back
 * (consuming that back press so the panel stack underneath does not also react to it).
 */
export function LayersCard({
  visible,
  layers,
  style,
  onClose,
  onChangeShowVehicles,
  onChangeShowStops,
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
      </View>
    </>
  );
}

function Row({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    gap: spacing.md,
    minWidth: 220,
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
});
