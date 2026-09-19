import type { NearbyStopDto } from "@transit/contracts";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ArrivalRow } from "@/shared/components/ArrivalRow";
import { formatDistance } from "@/shared/format/distance";
import { colors, fontSizes, monospaceFont, radii, spacing } from "@/shared/theme";

const MAX_ARRIVALS = 3;

interface NearbyStopCardProps {
  item: NearbyStopDto;
  now: number;
  onPress: (stopId: string) => void;
}

export function NearbyStopCard({ item, now, onPress }: NearbyStopCardProps) {
  const { stop, distanceMeters, nextArrivals } = item;
  return (
    <Pressable
      onPress={() => onPress(stop.id)}
      accessibilityRole="button"
      accessibilityLabel={stop.name}
      style={styles.card}
    >
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={1}>
          {stop.name}
        </Text>
        <Text style={styles.distance}>{formatDistance(distanceMeters)}</Text>
      </View>
      {nextArrivals.slice(0, MAX_ARRIVALS).map((arrival) => (
        <ArrivalRow key={arrival.tripId} arrival={arrival} now={now} />
      ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  name: {
    flex: 1,
    color: colors.ink,
    fontSize: fontSizes.body,
    fontWeight: "700",
  },
  distance: {
    color: colors.muted,
    fontFamily: monospaceFont,
    fontSize: 13,
  },
});
