import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { formatServiceDayLabel } from "@/shared/format/timetable";
import { colors, fontSizes, radii, spacing } from "@/shared/theme";

interface DaySelectorProps {
  /** Catalog service dates from today on (`YYYYMMDD`), ascending. */
  availableDates: readonly string[];
  today: string;
  selectedDate: string;
  onSelect: (date: string) => void;
}

/** Horizontal day chips (≥ 44 dp). Hidden when there is only one day to choose from. */
export function DaySelector({ availableDates, today, selectedDate, onSelect }: DaySelectorProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);
  const chipX = useRef<Record<string, number>>({});

  // Keeps the selected chip visible when the day changes by swiping.
  useEffect(() => {
    const x = chipX.current[selectedDate];
    if (x !== undefined)
      scrollRef.current?.scrollTo({ x: Math.max(0, x - spacing.lg), animated: true });
  }, [selectedDate]);

  if (availableDates.length <= 1) return null;

  const weekdays = t("timetable.weekdays", { returnObjects: true });
  const labels = {
    today: t("timetable.today"),
    tomorrow: t("timetable.tomorrow"),
    weekdays: Array.isArray(weekdays) ? weekdays.map(String) : [],
  };

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={t("timetable.days")}
      accessibilityHint={t("timetable.swipeHint")}
      contentContainerStyle={styles.row}
      style={styles.scroll}
    >
      {availableDates.map((date) => {
        const selected = date === selectedDate;
        const label = formatServiceDayLabel(date, today, labels);
        return (
          <Pressable
            key={date}
            onLayout={(event) => {
              chipX.current[date] = event.nativeEvent.layout.x;
            }}
            onPress={() => onSelect(date)}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    // ScrollView shrinks by default; inside the panel column that clipped the chips' bottom edge.
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: spacing.md,
  },
  row: {
    gap: spacing.sm,
    paddingVertical: 2,
  },
  chip: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderRadius: radii.panel,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    borderColor: colors.ink,
    backgroundColor: colors.ink,
  },
  label: {
    color: colors.ink,
    fontSize: fontSizes.body,
    fontWeight: "600",
  },
  labelSelected: {
    color: colors.surface,
  },
});
