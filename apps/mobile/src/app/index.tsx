import type { ArrivalDto, RouteSummaryDto, VehicleDto } from "@transit/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LAYERS_BUTTON_SIZE, LayersButton } from "@/features/map/LayersButton";
import { LayersCard } from "@/features/map/LayersCard";
import {
  AREA_FETCH_DEBOUNCE_MS,
  NEARBY_FOCUS_DELTA,
  STOPS_ZOOM_GATE_DELTA,
} from "@/features/map/map-config";
import { selectMapContent } from "@/features/map/select-map-content";
import { TransitMap, type TransitMapHandle } from "@/features/map/TransitMap";
import { useAreaStops } from "@/features/map/use-area-stops";
import { useAreaVehicles } from "@/features/map/use-area-vehicles";
import { useMapLayers } from "@/features/map/use-map-layers";
import { useUserLocation } from "@/features/map/use-user-location";
import { isWithinZoomGate } from "@/features/map/viewport";
import { ZoomHint } from "@/features/map/ZoomHint";
import type { NearbyRouteGroup } from "@/features/nearby/group-nearby-by-route";
import { MyStopChip } from "@/features/nearby/MyStopChip";
import { NearbyPanel } from "@/features/nearby/NearbyPanel";
import { useNearby } from "@/features/nearby/use-nearby";
import { RouteVehiclesPanel } from "@/features/route/RouteVehiclesPanel";
import { useRouteVehicles } from "@/features/route/use-route-vehicles";
import { SearchPanel } from "@/features/search/SearchPanel";
import { useSearch } from "@/features/search/use-search";
import { StopPanel } from "@/features/stop/StopPanel";
import { useStopArrivals } from "@/features/stop/use-stop-arrivals";
import { TimetablePanel } from "@/features/timetable/TimetablePanel";
import { useTimetableView } from "@/features/timetable/use-timetable-view";
import { FollowChip } from "@/features/vehicle/FollowChip";
import { resolveVehicleStop } from "@/features/vehicle/resolve-vehicle-stop";
import { TripPanel } from "@/features/vehicle/TripPanel";
import { useVehicleView } from "@/features/vehicle/use-vehicle-view";
import { VehiclePanel } from "@/features/vehicle/VehiclePanel";
import { BackButton } from "@/shared/components/BackButton";
import { BottomSheet } from "@/shared/components/BottomSheet";
import { SEARCH_BAR_HEIGHT, SearchBar } from "@/shared/components/SearchBar";
import { SearchInput } from "@/shared/components/SearchInput";
import { resolveBackAction } from "@/shared/panel/back-decision";
import type { SheetSnap } from "@/shared/panel/sheet-snap";
import { usePanelState } from "@/shared/panel/use-panel-state";
import { colors, spacing } from "@/shared/theme";
import { useDebouncedValue } from "@/shared/time/use-debounced-value";

const SHEET_COLLAPSED_HEIGHT = 120;
const SHEET_HALF_RATIO = 0.5;
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
  const [highlightedStopId, setHighlightedStopId] = useState<string | undefined>(undefined);
  const [layersCardOpen, setLayersCardOpen] = useState(false);
  const mapLayers = useMapLayers();
  const mapRef = useRef<TransitMapHandle>(null);
  const fittedRouteId = useRef<string | undefined>(undefined);
  const vehicleView = useVehicleView(panel, mapRef);
  const [region, setRegion] = useState<Region | undefined>(undefined);
  const debouncedRegion = useDebouncedValue(region, AREA_FETCH_DEBOUNCE_MS);

  const position = location.status === "available" ? location.position : undefined;
  const stopId = panel.kind === "stop" ? panel.stopId : undefined;
  const timetableStopId = panel.kind === "timetable" ? panel.stopId : undefined;
  const routeId = panel.kind === "route" ? panel.route.id : undefined;

  const nearby = useNearby(position, panel.kind === "nearby");
  const stopArrivals = useStopArrivals(stopId);
  const stopTimetable = useTimetableView(timetableStopId);
  const routeVehicles = useRouteVehicles(routeId);
  const search = useSearch(searchText);
  const areaStopsEnabled =
    (panel.kind === "nearby" || panel.kind === "search") && mapLayers.layers.showStops;
  const areaStops = useAreaStops(debouncedRegion, areaStopsEnabled);
  const areaVehiclesEnabled =
    (panel.kind === "nearby" || panel.kind === "search") && mapLayers.layers.showVehicles;
  const areaVehicles = useAreaVehicles(debouncedRegion, areaVehiclesEnabled);
  const stopsZoomGateHidden =
    mapLayers.layers.showStops &&
    region !== undefined &&
    !isWithinZoomGate(region, STOPS_ZOOM_GATE_DELTA);

  const topOffset = insets.top + spacing.md;
  const sheetHeights: Record<SheetSnap, number> = {
    collapsed: SHEET_COLLAPSED_HEIGHT,
    half: Math.round(height * SHEET_HALF_RATIO),
    full: height - (topOffset + SEARCH_BAR_HEIGHT + spacing.sm),
  };
  // The map and the recenter button never follow the sheet past its half height.
  const panelHeight = Math.min(sheetHeights[snap], sheetHeights.half);
  // The layers button sits above the recenter button; its card opens just above the button.
  const layersButtonBottom = panelHeight + spacing.lg + RECENTER_BUTTON_SIZE + spacing.md;
  const layersCardBottom = layersButtonBottom + LAYERS_BUTTON_SIZE + spacing.sm;

  // A new panel opens at half height; search and the timetable open full so the content fits.
  useEffect(() => {
    setSnap(panel.kind === "search" || panel.kind === "timetable" ? "full" : "half");
  }, [panel.kind]);

  // Android back: in Nearby with a highlighted stop, clears it first; otherwise walks the stack
  // and exits only from Nearby with nothing highlighted.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      const action = resolveBackAction(
        panel.kind === "nearby" ? "nearby" : "other",
        highlightedStopId !== undefined,
        canGoBack,
      );
      switch (action) {
        case "clearHighlightedStop":
          setHighlightedStopId(undefined);
          return true;
        case "goBack":
          back();
          return true;
        case "exitApp":
          return false;
      }
    });
    return () => subscription.remove();
  }, [panel.kind, highlightedStopId, canGoBack, back]);

  // Closing the search (back to Nearby) forgets the typed text.
  useEffect(() => {
    if (panel.kind === "nearby") setSearchText("");
  }, [panel.kind]);

  // The layers card only makes sense over the Nearby panel.
  useEffect(() => {
    if (panel.kind !== "nearby") setLayersCardOpen(false);
  }, [panel.kind]);

  // Nearby: the map follows the user's fix (start and recenter) at the largest Nearby radius.
  useEffect(() => {
    if (panel.kind !== "nearby" || !position) return;
    mapRef.current?.focusOn(position, NEARBY_FOCUS_DELTA);
  }, [panel.kind, position]);

  // Stop and Timetable: center on the stop once its data is known (the timetable map behaves
  // exactly like the Stop panel's).
  const stop = panel.kind === "timetable" ? stopTimetable.days?.stop : stopArrivals.data?.stop;
  const stopLat = stop?.lat;
  const stopLon = stop?.lon;
  useEffect(() => {
    if (
      (panel.kind === "stop" || panel.kind === "timetable") &&
      stopLat !== undefined &&
      stopLon !== undefined
    ) {
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

  // Trip (no live vehicle): center on the user's stop when it is among the nearby stops.
  const tripStop =
    panel.kind === "trip"
      ? nearby.data?.stops.find((item) => item.stop.id === panel.stopId)?.stop
      : undefined;
  const tripLat = tripStop?.lat;
  const tripLon = tripStop?.lon;
  useEffect(() => {
    if (panel.kind === "trip" && tripLat !== undefined && tripLon !== undefined) {
      mapRef.current?.focusOn({ lat: tripLat, lon: tripLon });
    }
  }, [panel.kind, tripLat, tripLon]);

  const mapContent = selectMapContent(
    panel.kind,
    nearby.data?.stops ?? [],
    stop,
    routeVehicleList,
    vehicleView.mapContent,
    tripStop,
    mapLayers.layers,
    highlightedStopId,
    areaStops?.stops ?? [],
    areaVehicles?.vehicles ?? [],
  );
  const selectedStopId =
    panel.kind === "vehicle" || panel.kind === "trip"
      ? panel.stopId
      : (stopId ?? timetableStopId ?? highlightedStopId);
  // Hidden once the stop is no longer in the Nearby data (e.g. it fell out of range).
  const highlightedStopName = nearby.data?.stops.find((item) => item.stop.id === highlightedStopId)
    ?.stop.name;

  const openStop = useCallback((id: string) => push({ kind: "stop", stopId: id }), [push]);
  const openRoute = (route: RouteSummaryDto) => push({ kind: "route", route });
  const seeStopArrivals = (id: string) => push({ kind: "stop", stopId: id });

  /** Live arrivals with a vehicle open the Vehicle view; the rest open the trip variant. */
  const openArrival = (arrival: ArrivalDto, arrivalStopId: string) => {
    if (arrival.source === "live" && arrival.vehicleId !== undefined) {
      push({
        kind: "vehicle",
        vehicleId: arrival.vehicleId,
        stopId: arrivalStopId,
        routeId: arrival.routeId,
        directionId: arrival.directionId,
      });
    } else {
      push({ kind: "trip", arrival, stopId: arrivalStopId });
    }
  };
  const openNearbyRoute = (group: NearbyRouteGroup) => {
    setHighlightedStopId(group.stop.id);
    const [first] = group.arrivals;
    if (first) openArrival(first, group.stop.id);
  };
  /** Opens the Vehicle view for any bus marker in Nearby, Search or Route (E005-T08, §3). */
  const openVehicle = useCallback(
    (vehicle: VehicleDto) => {
      push({
        kind: "vehicle",
        vehicleId: vehicle.id,
        stopId: resolveVehicleStop(vehicle.id, nearby.data?.stops, highlightedStopId),
        routeId: vehicle.routeId,
        directionId: vehicle.directionId,
      });
    },
    [nearby.data, highlightedStopId, push],
  );
  const focusVehicle = (vehicle: VehicleDto) =>
    mapRef.current?.focusOn({ lat: vehicle.lat, lon: vehicle.lon });

  return (
    <View style={styles.screen}>
      <TransitMap
        ref={mapRef}
        resetKey={`${mapLayers.layers.showStops}:${mapLayers.layers.showVehicles}`}
        showsUserLocation={position !== undefined}
        bottomInset={panelHeight}
        stops={mapContent.stops}
        selectedStopId={selectedStopId}
        vehicles={mapContent.vehicles}
        onStopPress={openStop}
        routeSegment={panel.kind === "vehicle" ? vehicleView.segment : undefined}
        onVehiclePress={
          panel.kind === "nearby" || panel.kind === "search" || panel.kind === "route"
            ? openVehicle
            : undefined
        }
        onUserPan={panel.kind === "vehicle" ? vehicleView.onUserPan : undefined}
        onRegionChangeComplete={setRegion}
      />

      <View style={[styles.topOverlay, { top: topOffset }]}>
        {panel.kind === "nearby" ? <SearchBar onPress={() => push({ kind: "search" })} /> : null}
        {panel.kind === "nearby" && highlightedStopName !== undefined ? (
          <MyStopChip
            stopName={highlightedStopName}
            onClear={() => setHighlightedStopId(undefined)}
          />
        ) : null}
        {panel.kind === "search" ? (
          <SearchInput value={searchText} onChangeText={setSearchText} onClose={back} />
        ) : null}
        {panel.kind === "stop" ||
        panel.kind === "timetable" ||
        panel.kind === "route" ||
        panel.kind === "trip" ? (
          <View style={styles.backButton}>
            <BackButton onPress={back} />
          </View>
        ) : null}
        {panel.kind === "vehicle" ? (
          <View style={styles.vehicleOverlay}>
            <BackButton onPress={back} />
            <FollowChip following={vehicleView.following} onPress={vehicleView.follow} />
          </View>
        ) : null}
      </View>

      {panel.kind === "nearby" && stopsZoomGateHidden ? (
        <View style={[styles.zoomHint, { top: topOffset + SEARCH_BAR_HEIGHT + spacing.sm }]}>
          <ZoomHint
            onPress={() => {
              // Zoom in to the Nearby span around what the user is looking at.
              if (region) {
                mapRef.current?.focusOn(
                  { lat: region.latitude, lon: region.longitude },
                  NEARBY_FOCUS_DELTA,
                );
              }
            }}
          />
        </View>
      ) : null}

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

      {panel.kind === "nearby" ? (
        <View style={[styles.layersButton, { bottom: layersButtonBottom }]}>
          <LayersButton onPress={() => setLayersCardOpen((open) => !open)} />
        </View>
      ) : null}

      <LayersCard
        visible={panel.kind === "nearby" && layersCardOpen}
        layers={mapLayers.layers}
        style={{ right: spacing.lg, bottom: layersCardBottom }}
        onClose={() => setLayersCardOpen(false)}
        onChangeShowVehicles={mapLayers.setShowVehicles}
        onChangeShowStops={mapLayers.setShowStops}
      />

      <BottomSheet snap={snap} heights={sheetHeights} onSnapChange={setSnap}>
        {panel.kind === "nearby" ? (
          <NearbyPanel
            data={nearby.data}
            error={nearby.error}
            isInitialLoading={nearby.isInitialLoading || location.status === "loading"}
            lastSuccessAt={nearby.lastSuccessAt}
            locationUnavailable={location.status === "unavailable"}
            highlightedStopId={highlightedStopId}
            onRoutePress={openNearbyRoute}
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
            onArrivalPress={(arrival) => openArrival(arrival, panel.stopId)}
            onOpenTimetable={() => push({ kind: "timetable", stopId: panel.stopId })}
            onRetry={stopArrivals.refetch}
          />
        ) : null}
        {panel.kind === "timetable" ? (
          <TimetablePanel
            data={stopTimetable.data}
            days={stopTimetable.days}
            error={stopTimetable.error}
            isLoading={stopTimetable.isLoading}
            selectedDate={stopTimetable.selectedDate}
            onSelectDate={stopTimetable.selectDate}
            onRetry={stopTimetable.retry}
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
        {panel.kind === "vehicle" ? (
          <VehiclePanel
            data={vehicleView.detail.data}
            error={vehicleView.detail.error}
            isInitialLoading={vehicleView.detail.isInitialLoading}
            stopId={panel.stopId}
            onSeeStopArrivals={() => {
              if (panel.stopId !== undefined) seeStopArrivals(panel.stopId);
            }}
            onRetry={vehicleView.detail.refetch}
          />
        ) : null}
        {panel.kind === "trip" ? (
          <TripPanel
            arrival={panel.arrival}
            onSeeStopArrivals={() => seeStopArrivals(panel.stopId)}
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
  vehicleOverlay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  layersButton: {
    position: "absolute",
    right: spacing.lg,
  },
  zoomHint: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    alignItems: "center",
  },
  recenterIcon: {
    color: colors.ink,
    fontSize: 24,
  },
});
