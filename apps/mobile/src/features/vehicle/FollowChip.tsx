import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radii, spacing } from "@/shared/theme";

interface FollowChipProps {
  following: boolean;
  onPress: () => void;
}

/** Map overlay: shows follow mode and lets the user resume it after panning. */
export function FollowChip({ following, onPress }: FollowChipProps) {
  const { t } = useTranslation();
  const label = following ? t("vehicle.following") : t("vehicle.follow");
  return (
    <Pressable
      onPress={onPress}
      disabled={following}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: following }}
      style={[styles.chip, following && styles.active]}
    >
      <Text style={[styles.label, following && styles.activeLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderRadius: radii.panel,
    backgroundColor: colors.surface,
    elevation: 4,
  },
  active: {
    backgroundColor: colors.ink,
  },
  label: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "600",
  },
  activeLabel: {
    color: colors.surface,
  },
});
