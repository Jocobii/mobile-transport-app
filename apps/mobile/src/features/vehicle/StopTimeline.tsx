import type { UpcomingStopDto } from "@transit/contracts";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { formatArrivalTime } from "@/shared/format/arrival-time";
import { colors, fontSizes, monospaceFont, spacing } from "@/shared/theme";

const LINE_WIDTH = 4;
const DOT_SIZE = 14;

interface StopTimelineProps {
  stops: UpcomingStopDto[];
  /** No row is tagged/bolded when there is no stop context (E005-T08). */
  targetStopId: string | undefined;
  /** Route color (`#RRGGBB`) for the line and dots. */
  lineColor: string;
  now: number;
}

/** Vertical line of upcoming stops with ETAs; the user's stop is bold and tagged. */
export function StopTimeline({ stops, targetStopId, lineColor, now }: StopTimelineProps) {
  const { t } = useTranslation();
  const labels = { now: t("arrival.now"), minutesUnit: t("arrival.minutes") };

  return (
    <View>
      {stops.map((upcoming, index) => {
        const isTarget = upcoming.stop.id === targetStopId;
        const time = formatArrivalTime(upcoming, now, labels);
        return (
          <View key={`${upcoming.stopSequence}:${upcoming.stop.id}`} style={styles.row}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.line,
                  { backgroundColor: lineColor },
                  index === 0 && styles.lineStart,
                  index === stops.length - 1 && styles.lineEnd,
                ]}
              />
              <View
                style={[styles.dot, { borderColor: lineColor }, isTarget && styles.targetDot]}
              />
            </View>
            <View style={styles.names}>
              <Text style={[styles.name, isTarget && styles.targetName]} numberOfLines={2}>
                {upcoming.stop.name}
              </Text>
              {isTarget ? <Text style={styles.tag}>{t("vehicle.yourStop")}</Text> : null}
            </View>
            <Text style={[styles.time, time.struck && styles.struck]}>
              {`${time.primary} ${time.unit}`.trim()}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 44,
  },
  rail: {
    width: DOT_SIZE,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
  },
  line: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: LINE_WIDTH,
  },
  lineStart: {
    top: "50%",
  },
  lineEnd: {
    bottom: "50%",
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    borderWidth: 3,
    backgroundColor: colors.surface,
  },
  targetDot: {
    backgroundColor: colors.ink,
  },
  names: {
    flex: 1,
  },
  name: {
    color: colors.inkSecondary,
    fontSize: fontSizes.body,
  },
  targetName: {
    color: colors.ink,
    fontWeight: "700",
  },
  tag: {
    color: colors.muted,
    fontSize: 13,
  },
  time: {
    minWidth: 56,
    textAlign: "right",
    color: colors.ink,
    fontFamily: monospaceFont,
    fontSize: fontSizes.body,
    fontWeight: "700",
  },
  struck: {
    textDecorationLine: "line-through",
    color: colors.muted,
  },
});
