import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontSizes, radii, spacing } from "@/shared/theme";

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message }: LoadingStateProps) {
  return (
    <View style={styles.container}>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {[0, 1, 2].map((index) => (
        <View key={index} style={styles.skeleton} />
      ))}
    </View>
  );
}

interface ErrorStateProps {
  onRetry: () => void;
}

export function ErrorState({ onRetry }: ErrorStateProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <Text style={styles.message}>{t("common.error")}</Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={t("common.retry")}
        style={styles.button}
      >
        <Text style={styles.buttonText}>{t("common.retry")}</Text>
      </Pressable>
    </View>
  );
}

interface EmptyStateProps {
  title: string;
  hint?: string;
}

export function EmptyState({ title, hint }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.message}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  title: {
    color: colors.ink,
    fontSize: fontSizes.body,
    fontWeight: "600",
  },
  message: {
    color: colors.muted,
    fontSize: fontSizes.body,
  },
  skeleton: {
    height: 84,
    borderRadius: radii.card,
    backgroundColor: colors.line,
  },
  button: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderRadius: radii.badge,
    backgroundColor: colors.ink,
  },
  buttonText: {
    color: colors.surface,
    fontSize: fontSizes.body,
    fontWeight: "600",
  },
});
