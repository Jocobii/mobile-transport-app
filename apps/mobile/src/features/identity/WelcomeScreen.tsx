import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { USER_NAME_MAX_LENGTH } from "@/shared/identity/identity";
import { colors, fontSizes, radii, spacing } from "@/shared/theme";

interface WelcomeScreenProps {
  /** Called with the raw (untrimmed) input on submit; the caller validates and saves it. */
  onSubmit: (name: string) => void;
}

/** First-launch screen (EPIC-010): asks for a free-text display name before the app starts. */
export function WelcomeScreen({ onSubmit }: WelcomeScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const canSubmit = name.trim().length > 0;

  function submit() {
    if (canSubmit) onSubmit(name);
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top + spacing.xl }]}>
        <Text style={styles.title}>{t("welcome.title")}</Text>
        <Text style={styles.message}>{t("welcome.message")}</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t("welcome.placeholder")}
          placeholderTextColor={colors.muted}
          autoFocus
          maxLength={USER_NAME_MAX_LENGTH}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={submit}
          style={styles.input}
          accessibilityLabel={t("welcome.placeholder")}
        />
        <Pressable
          onPress={submit}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel={t("welcome.continue")}
          accessibilityState={{ disabled: !canSubmit }}
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>{t("welcome.continue")}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  title: {
    color: colors.ink,
    fontSize: fontSizes.title,
    fontWeight: "700",
  },
  message: {
    color: colors.inkSecondary,
    fontSize: fontSizes.body,
  },
  input: {
    marginTop: spacing.md,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.card,
    paddingHorizontal: spacing.lg,
    fontSize: fontSizes.body,
    color: colors.ink,
  },
  button: {
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: radii.badge,
    backgroundColor: colors.ink,
  },
  buttonDisabled: {
    backgroundColor: colors.line,
  },
  buttonText: {
    color: colors.surface,
    fontSize: fontSizes.body,
    fontWeight: "600",
  },
});
