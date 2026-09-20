import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text } from "react-native";
import { formatFreshness, secondsSince } from "@/shared/format/freshness";
import { colors } from "@/shared/theme";
import { RefreshIcon } from "./icons/RefreshIcon";

interface FreshnessLabelProps {
  /** Epoch seconds of the last successful response; nothing is shown before the first one. */
  lastSuccessAt: number | undefined;
  now: number;
  /** Makes the label a button that refreshes now ("Actualizado hace X s · Actualizar"). */
  onRefresh?: () => void;
  /** A refresh is running: the label reads "Actualizando…" and cannot be pressed again. */
  refreshing?: boolean;
}

export function FreshnessLabel({ lastSuccessAt, now, onRefresh, refreshing }: FreshnessLabelProps) {
  const { t } = useTranslation();
  if (lastSuccessAt === undefined) return null;

  const label = formatFreshness(secondsSince(lastSuccessAt, now));
  const freshness = <Text style={styles.text}>{t(label.key, label.params)}</Text>;
  if (!onRefresh) return freshness;

  return (
    <Pressable
      onPress={onRefresh}
      disabled={refreshing}
      accessibilityRole="button"
      accessibilityLabel={t("freshness.refreshLabel")}
      accessibilityState={{ busy: refreshing === true, disabled: refreshing === true }}
      style={styles.button}
    >
      {refreshing ? (
        <Text style={styles.text}>{t("freshness.refreshing")}</Text>
      ) : (
        <>
          {freshness}
          <Text style={styles.text}>·</Text>
          <RefreshIcon />
          <Text style={styles.action}>{t("freshness.refresh")}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: {
    color: colors.muted,
    fontSize: 13,
  },
  button: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  action: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "600",
  },
});
