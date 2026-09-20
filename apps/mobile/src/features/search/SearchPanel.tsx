import type { RouteSummaryDto, SearchResponse, StopSummaryDto } from "@transit/contracts";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { MAX_FILTER_ROUTES, type RouteFilter } from "@/features/map/route-filter";
import { ChevronIcon } from "@/shared/components/icons/ChevronIcon";
import { EmptyState, ErrorState } from "@/shared/components/PanelStatus";
import { RouteBadge } from "@/shared/components/RouteBadge";
import { SheetSectionList } from "@/shared/components/SheetLists";
import { colors, fontSizes, radii, spacing } from "@/shared/theme";
import { RoutePickerBanner } from "./RoutePickerBanner";
import { pickerRowState } from "./route-picker";
import { toSearchSections } from "./search-sections";

/** Example queries offered as chips; tapping one fills the search field. */
const EXAMPLE_QUERIES = ["436", "54"];

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
  /** Route picker for the route filter (E007-T03): results are routes only and tapping toggles. */
  pickMode?: RoutePickerConfig | undefined;
}

export interface RoutePickerConfig {
  filter: RouteFilter;
  onToggleRoute: (route: RouteSummaryDto) => void;
  onDone: () => void;
}

/** The search panel; in pick mode a banner with a "done" button sits above the results. */
export function SearchPanel(props: SearchPanelProps) {
  const { pickMode } = props;
  return (
    <View style={styles.container}>
      {pickMode ? (
        <RoutePickerBanner
          full={pickMode.filter.routes.length >= MAX_FILTER_ROUTES}
          onDone={pickMode.onDone}
        />
      ) : null}
      <SearchResults {...props} />
    </View>
  );
}

function SearchResults({
  query,
  data,
  error,
  isLoading,
  onExamplePress,
  onRoutePress,
  onStopPress,
  onRetry,
  pickMode,
}: SearchPanelProps) {
  const { t } = useTranslation();

  if (query === undefined) {
    return (
      <View style={styles.message}>
        <Text style={styles.text}>{t(pickMode ? "routePicker.hint" : "search.hint")}</Text>
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

  const sections = toSearchSections(data, pickMode !== undefined);
  if (sections.length === 0) {
    return <EmptyState title={t("search.noResults", { query })} hint={t("search.noResultsHint")} />;
  }

  return (
    <SheetSectionList
      sections={sections}
      keyExtractor={(item) =>
        item.kind === "route" ? `route:${item.route.id}` : `stop:${item.stop.id}`
      }
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionTitle}>{t(section.title)}</Text>
      )}
      renderItem={({ item }) =>
        item.kind === "route" ? (
          pickMode ? (
            <PickRouteRow
              route={item.route}
              {...pickerRowState(item.route.id, pickMode.filter)}
              onToggle={pickMode.onToggleRoute}
            />
          ) : (
            <RouteRow route={item.route} onPress={onRoutePress} />
          )
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

function PickRouteRow({
  route,
  selected,
  disabled,
  onToggle,
}: {
  route: RouteSummaryDto;
  selected: boolean;
  disabled: boolean;
  onToggle: (route: RouteSummaryDto) => void;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={() => onToggle(route)}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={`${route.shortName} ${route.longName}`}
      style={[styles.row, disabled ? pickStyles.disabled : undefined]}
    >
      <RouteBadge label={route.shortName} color={route.color} textColor={route.textColor} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {route.longName}
        </Text>
        <Text style={styles.rowSubtitle}>
          {t(`agency.${route.feedId}`, { defaultValue: route.feedId })}
        </Text>
        {selected ? <Text style={pickStyles.selectedText}>{t("routePicker.selected")}</Text> : null}
      </View>
      <View style={[pickStyles.check, selected ? pickStyles.checkOn : undefined]}>
        {selected ? <Text style={pickStyles.checkMark}>✓</Text> : null}
      </View>
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

const pickStyles = StyleSheet.create({
  disabled: {
    opacity: 0.4,
  },
  selectedText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: {
    backgroundColor: colors.ink,
  },
  checkMark: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: "700",
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
