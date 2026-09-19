import type {
  NearbyStopDto,
  RouteSummaryDto,
  StopSummaryDto,
  VehicleDto,
} from "@transit/contracts";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TransitMap, type TransitMapHandle } from "@/features/map/TransitMap";
import { useUserLocation } from "@/features/map/use-user-location";
import { collectApproachingVehicles } from "@/features/nearby/collect-approaching-vehicles";
import { NearbyPanel } from "@/features/nearby/NearbyPanel";
import { useNearby } from "@/features/nearby/use-nearby";
import { RouteVehiclesPanel } from "@/features/route/RouteVehiclesPanel";
import { useRouteVehicles } from "@/features/route/use-route-vehicles";
import { SearchPanel } from "@/features/search/SearchPanel";
import { useSearch } from "@/features/search/use-search";
import { StopPanel } from "@/features/stop/StopPanel";
import { useStopArrivals } from "@/features/stop/use-stop-arrivals";
import { BackButton } from "@/shared/components/BackButton";
import { BottomSheet } from "@/shared/components/BottomSheet";
import { SEARCH_BAR_HEIGHT, SearchBar } from "@/shared/components/SearchBar";
import { SearchInput } from "@/shared/components/SearchInput";
import type { Panel } from "@/shared/panel/panel-state";
import type { SheetSnap } from "@/shared/panel/sheet-snap";
import { usePanelState } from "@/shared/panel/use-panel-state";
import { colors, spacing } from "@/shared/theme";

const SHEET_COLLAPSED_HEIGHT = 120;
const SHEET_HALF_RATIO = 0.5;

interface MapContent {
  stops: StopSummaryDto[];
  vehicles: VehicleDto[];
}

/** What the map draws for the active panel. Search keeps showing the nearby content behind it. */
function selectMapContent(
  panelKind: Panel["kind"],
  nearbyStops: NearbyStopDto[],
  stop: StopSummaryDto | undefined,
  routeVehicles: VehicleDto[] | undefined,
): MapContent {
  switch (panelKind) {
    case "stop":
      return { stops: stop ? [stop] : [], vehicles: [] };
    case "route":
      return { stops: [], vehicles: routeVehicles ?? [] };
    case "nearby":
    case "search":
      return {
        stops: nearbyStops.map((item) => item.stop),
        vehicles: collectApproachingVehicles(nearbyStops),
      };
  }
}
const RECENTER_BUTTON_SIZE = 48;

/** The single screen: one map plus a bottom panel driven by the panel state machine. */
export default function HomeScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { panel, canGoBack, push, back } = usePanelState();
  const { location, recenter } = useUserLocation();
  const [searchText, setSearchText] = useState("");
  const [snap, setSnap] = useState<SheetSnap>("half");
  const mapRef = useRef<TransitMapHandle>(null);
  const fittedRouteId = useRef<string | undefined>(undefined);

  const position = location.status === "available" ? location.position : undefined;
  const stopId = panel.kind === "stop" ? panel.stopId : undefined;
  const routeId = panel.kind === "route" ? panel.route.id : undefined;

  const nearby = useNearby(position, panel.kind === "nearby");
  const stopArrivals = useStopArrivals(stopId);
  const routeVehicles = useRouteVehicles(routeId);
  const search = useSearch(searchText);

  const topOffset = insets.top + spacing.md;
  const sheetHeights: Record<SheetSnap, number> = {
    collapsed: SHEET_COLLAPSED_HEIGHT,
    half: Math.round(height * SHEET_HALF_RATIO),
    full: height - (topOffset + SEARCH_BAR_HEIGHT + spacing.sm),
  };
  // The map and the recenter button never follow the sheet past its half height.
  const panelHeight = Math.min(sheetHeights[snap], sheetHeights.half);

  // A new panel opens at half height; search opens full so the results fit.
  useEffect(() => {
    setSnap(panel.kind === "search" ? "full" : "half");
  }, [panel.kind]);

  // Android back walks the panel stack and exits only from Nearby.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!canGoBack) return false;
      back();
      return true;
    });
    return () => subscription.remove();
  }, [canGoBack, back]);

  // Closing the search (back to Nearby) forgets the typed text.
  useEffect(() => {
    if (panel.kind === "nearby") setSearchText("");
  }, [panel.kind]);

  // Nearby: the map follows the user's fix (start and recenter).
  useEffect(() => {
    if (panel.kind === "nearby" && position) mapRef.current?.focusOn(position);
  }, [panel.kind, position]);

  // Stop: center on the stop once its data is known.
  const stop = stopArrivals.data?.stop;
  const stopLat = stop?.lat;
  const stopLon = stop?.lon;
  useEffect(() => {
    if (panel.kind === "stop" && stopLat !== undefined && stopLon !== undefined) {
      mapRef.current?.focusOn({ lat: stopLat, lon: stopLon });
    }
  }, [panel.kind, stopLat, stopLon]);

  // Route: fit the map to the vehicles once per opened route (later refreshes do not move it).
  const routeVehicleList = routeVehicles.data?.vehicles;
  useEffect(() => {
    if (panel.kind !== "route") {
      fittedRouteId.current = undefined;
      return;
    }
    if (!routeVehicleList || routeVehicleList.length === 0) return;
    if (fittedRouteId.current === panel.route.id) return;
    fittedRouteId.current = panel.route.id;
    mapRef.current?.fitTo(
      routeVehicleList.map((vehicle) => ({ lat: vehicle.lat, lon: vehicle.lon })),
    );
  }, [panel, routeVehicleList]);

  const mapContent = selectMapContent(panel.kind, nearby.data?.stops ?? [], stop, routeVehicleList);

  const openStop = (id: string) => push({ kind: "stop", stopId: id });
  const openRoute = (route: RouteSummaryDto) => push({ kind: "route", route });
  const focusVehicle = (vehicle: VehicleDto) =>
    mapRef.current?.focusOn({ lat: vehicle.lat, lon: vehicle.lon });

  return (
    <View style={styles.screen}>
      <TransitMap
        ref={mapRef}
        showsUserLocation={position !== undefined}
        bottomInset={panelHeight}
        stops={mapContent.stops}
        selectedStopId={stopId}
        vehicles={mapContent.vehicles}
        onStopPress={openStop}
      />

      <View style={[styles.topOverlay, { top: topOffset }]}>
        {panel.kind === "nearby" ? <SearchBar onPress={() => push({ kind: "search" })} /> : null}
        {panel.kind === "search" ? (
          <SearchInput value={searchText} onChangeText={setSearchText} onClose={back} />
        ) : null}
        {panel.kind === "stop" || panel.kind === "route" ? (
          <View style={styles.backButton}>
            <BackButton onPress={back} />
          </View>
        ) : null}
      </View>

      {panel.kind === "nearby" ? (
        <Pressable
          onPress={recenter}
          accessibilityRole="button"
          accessibilityLabel={t("map.recenter")}
          style={[styles.recenter, { bottom: panelHeight + spacing.lg }]}
        >
          <Text style={styles.recenterIcon}>◎</Text>
        </Pressable>
      ) : null}

      <BottomSheet snap={snap} heights={sheetHeights} onSnapChange={setSnap}>
        {panel.kind === "nearby" ? (
          <NearbyPanel
            data={nearby.data}
            error={nearby.error}
            isInitialLoading={nearby.isInitialLoading || location.status === "loading"}
            lastSuccessAt={nearby.lastSuccessAt}
            locationUnavailable={location.status === "unavailable"}
            onStopPress={openStop}
            onRetry={nearby.refetch}
          />
        ) : null}
        {panel.kind === "stop" ? (
          <StopPanel
            data={stopArrivals.data}
            error={stopArrivals.error}
            isInitialLoading={stopArrivals.isInitialLoading}
            lastSuccessAt={stopArrivals.lastSuccessAt}
            userPosition={position}
            onRetry={stopArrivals.refetch}
          />
        ) : null}
        {panel.kind === "search" ? (
          <SearchPanel
            query={search.query}
            data={search.data}
            error={search.error}
            isLoading={search.isLoading}
            onExamplePress={setSearchText}
            onRoutePress={openRoute}
            onStopPress={openStop}
            onRetry={search.retry}
          />
        ) : null}
        {panel.kind === "route" ? (
          <RouteVehiclesPanel
            route={panel.route}
            data={routeVehicles.data}
            error={routeVehicles.error}
            isInitialLoading={routeVehicles.isInitialLoading}
            lastSuccessAt={routeVehicles.lastSuccessAt}
            onVehiclePress={focusVehicle}
            onRetry={routeVehicles.refetch}
          />
        ) : null}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.map,
  },
  topOverlay: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
  },
  backButton: {
    alignSelf: "flex-start",
  },
  recenter: {
    position: "absolute",
    right: spacing.lg,
    width: RECENTER_BUTTON_SIZE,
    height: RECENTER_BUTTON_SIZE,
    borderRadius: RECENTER_BUTTON_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    elevation: 4,
  },
  recenterIcon: {
    color: colors.ink,
    fontSize: 24,
  },
});
