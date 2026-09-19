import type { UpcomingStopDto, VehicleDetailResponse } from "@transit/contracts";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { NoticeCard } from "@/shared/components/NoticeCard";
import { EmptyState, ErrorState, LoadingState } from "@/shared/components/PanelStatus";
import { RouteBadge } from "@/shared/components/RouteBadge";
import { StatusChip } from "@/shared/components/StatusChip";
import { formatArrivalStatus } from "@/shared/format/arrival-status";
import { routeColors } from "@/shared/format/route-colors";
import { colors, fontSizes, radii, spacing, statusColors } from "@/shared/theme";
import { useNow } from "@/shared/time/use-now";
import { StopTimeline } from "./StopTimeline";
import { stopsUntil } from "./stops-until";
import { isVehicleGone } from "./use-vehicle-detail";

const STOPS_AFTER_TARGET = 2;
const SECONDS_PER_MINUTE = 60;

interface VehiclePanelProps {
  data: VehicleDetailResponse | undefined;
  error: unknown;
  isInitialLoading: boolean;
  stopId: string;
  onSeeStopArrivals: () => void;
  onRetry: () => void;
}

/** Live vehicle view: where the bus is and when it reaches the user's stop. */
export function VehiclePanel({
  data,
  error,
  isInitialLoading,
  stopId,
  onSeeStopArrivals,
  onRetry,
}: VehiclePanelProps) {
  const { t } = useTranslation();
  const now = useNow();

  if (isVehicleGone(error)) {
    return (
      <View style={styles.container}>
        <NoticeCard
          tone="neutral"
          message={t("vehicle.gone")}
          actionLabel={t("vehicle.seeStopArrivals")}
          onAction={onSeeStopArrivals}
        />
      </View>
    );
  }
  if (data) {
    return <LiveView data={data} stopId={stopId} now={now} onSeeStopArrivals={onSeeStopArrivals} />;
  }
  if (error !== undefined) return <ErrorState onRetry={onRetry} />;
  if (isInitialLoading) return <LoadingState />;
  return <EmptyState title={t("vehicle.gone")} />;
}

interface LiveViewProps {
  data: VehicleDetailResponse;
  stopId: string;
  now: number;
  onSeeStopArrivals: () => void;
}

function LiveView({ data, stopId, now, onSeeStopArrivals }: LiveViewProps) {
  const { t } = useTranslation();
  const { vehicle, upcomingStops } = data;
  const { remaining, target, passed } = stopsUntil(upcomingStops, stopId);
  const palette = routeColors(vehicle.routeColor, vehicle.routeTextColor);

  const targetIndex = target ? upcomingStops.indexOf(target) : -1;
  const timelineStops: UpcomingStopDto[] = passed
    ? []
    : upcomingStops.slice(0, targetIndex + 1 + STOPS_AFTER_TARGET);

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <RouteBadge
          label={vehicle.routeShortName}
          color={vehicle.routeColor}
          textColor={vehicle.routeTextColor}
        />
        <Text style={styles.headsign} numberOfLines={2}>
          {t("vehicle.destination", { headsign: vehicle.headsign })}
        </Text>
      </View>

      {passed || !target ? (
        <NoticeCard
          tone="neutral"
          message={t("vehicle.passed")}
          actionLabel={t("vehicle.seeStopArrivals")}
          onAction={onSeeStopArrivals}
        />
      ) : target.status !== "normal" ? (
        <NoticeCard
          tone="problem"
          message={target.status === "canceled" ? t("vehicle.canceled") : t("vehicle.skipped")}
          actionLabel={t("vehicle.seeStopArrivals")}
          onAction={onSeeStopArrivals}
        />
      ) : (
        <ArrivalCard
          target={target}
          remaining={remaining}
          positionAgeSec={Math.max(0, now - vehicle.updatedAt)}
          now={now}
        />
      )}

      {timelineStops.length > 0 ? (
        <StopTimeline
          stops={timelineStops}
          targetStopId={stopId}
          lineColor={palette.background}
          now={now}
        />
      ) : null}
    </ScrollView>
  );
}

interface ArrivalCardProps {
  target: UpcomingStopDto;
  remaining: number;
  positionAgeSec: number;
  now: number;
}

function ArrivalCard({ target, remaining, positionAgeSec, now }: ArrivalCardProps) {
  const { t } = useTranslation();
  const status = formatArrivalStatus(target);
  const { fg, bg } = statusColors[status.status];
  const minutes = Math.floor((target.time - now) / SECONDS_PER_MINUTE);

  return (
    <View style={[styles.card, { backgroundColor: bg }]}>
      <Text style={[styles.arrives, { color: fg }]}>
        {minutes < 1 ? t("vehicle.arrivesNow") : t("vehicle.arrivesIn", { minutes })}
      </Text>
      <StatusChip status={status.status} label={t(status.key, status.params)} />
      <Text style={styles.meta}>
        {t("vehicle.stopsLeft", { count: remaining })}
        {" · "}
        {t("vehicle.positionAge", { seconds: Math.round(positionAgeSec) })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  headsign: {
    flex: 1,
    color: colors.ink,
    fontSize: fontSizes.title,
    fontWeight: "700",
  },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.card,
  },
  arrives: {
    fontSize: fontSizes.title,
    fontWeight: "700",
  },
  meta: {
    color: colors.inkSecondary,
    fontSize: 13,
  },
});
