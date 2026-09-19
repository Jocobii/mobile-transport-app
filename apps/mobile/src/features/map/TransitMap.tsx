import type { VehicleDto } from "@transit/contracts";
import { type Ref, useImperativeHandle, useRef } from "react";
import { StyleSheet } from "react-native";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";
import type { Position } from "@/shared/geo/position";
import { colors } from "@/shared/theme";
import { FALLBACK_CENTER, FALLBACK_DELTA, FIT_PADDING, FOCUS_DELTA } from "./map-config";
import { MAP_STYLE } from "./map-style";
import { StopMarker } from "./StopMarker";
import { VehicleMarker, vehicleMarkerKey } from "./VehicleMarker";

export interface MapStop {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

/** Camera commands the screen sends to the map. */
export interface TransitMapHandle {
  focusOn: (position: Position) => void;
  fitTo: (positions: Position[]) => void;
}

interface TransitMapProps {
  ref?: Ref<TransitMapHandle>;
  showsUserLocation: boolean;
  /** Height covered by the bottom panel; keeps the focused point in the visible area. */
  bottomInset: number;
  stops: MapStop[];
  selectedStopId?: string | undefined;
  vehicles: VehicleDto[];
  onStopPress: (stopId: string) => void;
}

/** The single map of the app. It is never unmounted. */
export function TransitMap({
  ref,
  showsUserLocation,
  bottomInset,
  stops,
  selectedStopId,
  vehicles,
  onStopPress,
}: TransitMapProps) {
  const mapRef = useRef<MapView>(null);

  useImperativeHandle(ref, () => {
    const focusOn = (position: Position) => {
      mapRef.current?.animateToRegion(
        {
          latitude: position.lat,
          longitude: position.lon,
          latitudeDelta: FOCUS_DELTA,
          longitudeDelta: FOCUS_DELTA,
        },
        400,
      );
    };
    const fitTo = (positions: Position[]) => {
      const [first] = positions;
      if (!first) return;
      if (positions.length === 1) {
        focusOn(first);
        return;
      }
      mapRef.current?.fitToCoordinates(
        positions.map((p) => ({ latitude: p.lat, longitude: p.lon })),
        { edgePadding: FIT_PADDING, animated: true },
      );
    };
    return { focusOn, fitTo };
  }, []);

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      provider={PROVIDER_GOOGLE}
      initialRegion={{
        latitude: FALLBACK_CENTER.lat,
        longitude: FALLBACK_CENTER.lon,
        latitudeDelta: FALLBACK_DELTA,
        longitudeDelta: FALLBACK_DELTA,
      }}
      mapPadding={{ top: 0, right: 0, bottom: bottomInset, left: 0 }}
      showsUserLocation={showsUserLocation}
      showsMyLocationButton={false}
      toolbarEnabled={false}
      customMapStyle={MAP_STYLE}
    >
      {stops.map((stop) => (
        <StopMarker
          key={`${stop.id}:${stop.id === selectedStopId}`}
          id={stop.id}
          name={stop.name}
          lat={stop.lat}
          lon={stop.lon}
          selected={stop.id === selectedStopId}
          onPress={onStopPress}
        />
      ))}
      {vehicles.map((vehicle) => (
        <VehicleMarker key={vehicleMarkerKey(vehicle)} vehicle={vehicle} />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.map,
  },
});
