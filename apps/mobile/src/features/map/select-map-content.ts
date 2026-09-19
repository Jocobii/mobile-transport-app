import type { NearbyStopDto, StopSummaryDto, VehicleDto } from "@transit/contracts";
import { collectApproachingVehicles } from "@/features/nearby/collect-approaching-vehicles";
import type { VehicleMapContent } from "@/features/vehicle/use-vehicle-view";
import type { Panel } from "@/shared/panel/panel-state";
import type { MapLayers } from "./map-layers";

export interface MapContent {
  stops: StopSummaryDto[];
  vehicles: VehicleDto[];
}

/** Stops from both sources, one entry per id (first occurrence wins). */
function dedupeStopsById(stops: StopSummaryDto[]): StopSummaryDto[] {
  const byId = new Map<string, StopSummaryDto>();
  for (const stop of stops) {
    if (!byId.has(stop.id)) byId.set(stop.id, stop);
  }
  return [...byId.values()];
}

/** Vehicles from both sources, one entry per id (first occurrence wins). */
function dedupeVehiclesById(vehicles: VehicleDto[]): VehicleDto[] {
  const byId = new Map<string, VehicleDto>();
  for (const vehicle of vehicles) {
    if (!byId.has(vehicle.id)) byId.set(vehicle.id, vehicle);
  }
  return [...byId.values()];
}

/**
 * What the map draws for the active panel. Search keeps showing the nearby content behind it.
 * Layer toggles (`showVehicles`, `showStops`) only apply to Nearby and Search; every other panel
 * ignores them. Hiding stops keeps the highlighted boarding stop visible, if any; `areaStops`
 * (the visible-area stops layer) is otherwise merged with the nearby stops, deduped by id.
 * `areaVehicles` (the visible-area buses layer) is merged with the approaching buses, deduped by
 * id with the approaching version winning (it carries the stop it is approaching).
 */
export function selectMapContent(
  panelKind: Panel["kind"],
  nearbyStops: NearbyStopDto[],
  stop: StopSummaryDto | undefined,
  routeVehicles: VehicleDto[] | undefined,
  vehicleContent: VehicleMapContent,
  tripStop: StopSummaryDto | undefined,
  layers: MapLayers,
  highlightedStopId: string | undefined,
  areaStops: StopSummaryDto[],
  areaVehicles: VehicleDto[],
): MapContent {
  switch (panelKind) {
    case "vehicle":
      return vehicleContent;
    case "trip":
      return { stops: tripStop ? [tripStop] : [], vehicles: [] };
    case "stop":
    case "timetable":
      return { stops: stop ? [stop] : [], vehicles: [] };
    case "route":
      return { stops: [], vehicles: routeVehicles ?? [] };
    case "nearby":
    case "search": {
      const nearbyMapped = nearbyStops.map((item) => item.stop);
      const stops = layers.showStops
        ? dedupeStopsById([...nearbyMapped, ...areaStops])
        : nearbyMapped.filter((item) => item.id === highlightedStopId);
      const vehicles = layers.showVehicles
        ? dedupeVehiclesById([...collectApproachingVehicles(nearbyStops), ...areaVehicles])
        : [];
      return { stops, vehicles };
    }
  }
}
