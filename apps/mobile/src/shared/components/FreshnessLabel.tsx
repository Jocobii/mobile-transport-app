import { useTranslation } from "react-i18next";
import { StyleSheet, Text } from "react-native";
import { formatFreshness, secondsSince } from "@/shared/format/freshness";
import { colors } from "@/shared/theme";

interface FreshnessLabelProps {
  /** Epoch seconds of the last successful response; nothing is shown before the first one. */
  lastSuccessAt: number | undefined;
  now: number;
}

export function FreshnessLabel({ lastSuccessAt, now }: FreshnessLabelProps) {
  const { t } = useTranslation();
  if (lastSuccessAt === undefined) return null;

  const label = formatFreshness(secondsSince(lastSuccessAt, now));
  return <Text style={styles.text}>{t(label.key, label.params)}</Text>;
}

const styles = StyleSheet.create({
  text: {
    color: colors.muted,
    fontSize: 13,
  },
});
