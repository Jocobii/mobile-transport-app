import type { RouteSummaryDto, SearchResponse, StopSummaryDto } from "@transit/contracts";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import { ChevronIcon } from "@/shared/components/ChevronIcon";
import { EmptyState, ErrorState } from "@/shared/components/PanelStatus";
import { RouteBadge } from "@/shared/components/RouteBadge";
import { colors, fontSizes, radii, spacing } from "@/shared/theme";

/** Example queries offered as chips; tapping one fills the search field. */
const EXAMPLE_QUERIES = ["436", "54"];

type SearchItem =
  | { kind: "route"; route: RouteSummaryDto }
  | { kind: "stop"; stop: StopSummaryDto };

interface SearchSection {
  title: "search.routes" | "search.stops";
  data: SearchItem[];
}

function toSections(data: SearchResponse): SearchSection[] {
  const sections: SearchSection[] = [];
  if (data.routes.length > 0) {
    sections.push({
      title: "search.routes",
      data: data.routes.map((route) => ({ kind: "route", route })),
    });
  }
  if (data.stops.length > 0) {
    sections.push({
      title: "search.stops",
      data: data.stops.map((stop) => ({ kind: "stop", stop })),
    });
  }
  return sections;
}

interface SearchPanelProps {
  /** The normalized query being shown, or undefined before anything was typed. */
  query: string | undefined;
  data: SearchResponse | undefined;
  error: unknown;
  isLoading: boolean;
  onExamplePress: (query: string) => void;
  onRoutePress: (route: RouteSummaryDto) => void;
  onStopPress: (stopId: string) => void;
  onRetry: () => void;
}

export function SearchPanel({
  query,
  data,
  error,
  isLoading,
  onExamplePress,
  onRoutePress,
  onStopPress,
  onRetry,
}: SearchPanelProps) {
  const { t } = useTranslation();

  if (query === undefined) {
    return (
      <View style={styles.message}>
        <Text style={styles.text}>{t("search.hint")}</Text>
        <View style={styles.chips}>
          {EXAMPLE_QUERIES.map((example) => (
            <Pressable
              key={example}
              onPress={() => onExamplePress(example)}
              accessibilityRole="button"
              accessibilityLabel={example}
              style={styles.chip}
            >
              <Text style={styles.chipText}>{example}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  if (error !== undefined) return <ErrorState onRetry={onRetry} />;
  if (isLoading || !data) return <ActivityIndicator style={styles.loading} color={colors.ink} />;

  const sections = toSections(data);
  if (sections.length === 0) {
    return <EmptyState title={t("search.noResults", { query })} hint={t("search.noResultsHint")} />;
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) =>
        item.kind === "route" ? `route:${item.route.id}` : `stop:${item.stop.id}`
      }
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionTitle}>{t(section.title)}</Text>
      )}
      renderItem={({ item }) =>
        item.kind === "route" ? (
          <RouteRow route={item.route} onPress={onRoutePress} />
        ) : (
          <StopRow stop={item.stop} onPress={onStopPress} />
        )
      }
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      stickySectionHeadersEnabled={false}
      contentContainerStyle={styles.list}
    />
  );
}

function RouteRow({
  route,
  onPress,
}: {
  route: RouteSummaryDto;
  onPress: (route: RouteSummaryDto) => void;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={() => onPress(route)}
      accessibilityRole="button"
      accessibilityLabel={`${route.shortName} ${route.longName}`}
      style={styles.row}
    >
      <RouteBadge label={route.shortName} color={route.color} textColor={route.textColor} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {route.longName}
        </Text>
        <Text style={styles.rowSubtitle}>
          {t(`agency.${route.feedId}`, { defaultValue: route.feedId })}
        </Text>
      </View>
      <ChevronIcon />
    </Pressable>
  );
}

function StopRow({ stop, onPress }: { stop: StopSummaryDto; onPress: (stopId: string) => void }) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={() => onPress(stop.id)}
      accessibilityRole="button"
      accessibilityLabel={stop.name}
      style={styles.row}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {stop.name}
        </Text>
        <Text style={styles.rowSubtitle}>{t("stop.code", { code: stop.code })}</Text>
      </View>
      <ChevronIcon />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  message: {
    gap: spacing.lg,
    paddingTop: spacing.sm,
  },
  text: {
    color: colors.muted,
    fontSize: fontSizes.body,
  },
  chips: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  chip: {
    minHeight: 44,
    minWidth: 64,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipText: {
    color: colors.ink,
    fontSize: fontSizes.body,
    fontWeight: "600",
  },
  loading: {
    marginTop: spacing.xl,
  },
  list: {
    paddingBottom: spacing.xl,
  },
  sectionTitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    color: colors.ink,
    fontSize: fontSizes.body,
    fontWeight: "600",
  },
  rowSubtitle: {
    color: colors.muted,
    fontSize: 13,
  },
});
