import type { StopSummaryDto, VehicleDto } from "@transit/contracts";
import { type RefObject, useEffect, useRef, useState } from "react";
import type { RouteSegment, TransitMapHandle } from "@/features/map/TransitMap";
import { routeColors } from "@/shared/format/route-colors";
import type { Panel } from "@/shared/panel/panel-state";
import { fallbackSegment, segmentToStop } from "./segment-to-stop";
import { stopsUntil } from "./stops-until";
import { useRouteShape } from "./use-route-shape";
import { useVehicleDetail } from "./use-vehicle-detail";

export interface VehicleMapContent {
  stops: StopSummaryDto[];
  vehicles: VehicleDto[];
}

/**
 * Everything the Vehicle panel needs on the map: the polled vehicle, the segment of route up to
 * the user's stop, the one-time fit and the follow mode (the map keeps the bus centered until the
 * user pans; `follow()` resumes it).
 */
export function useVehicleView(panel: Panel, mapRef: RefObject<TransitMapHandle | null>) {
  const vehiclePanel = panel.kind === "vehicle" ? panel : undefined;
  const detail = useVehicleDetail(vehiclePanel?.vehicleId);
  const shape = useRouteShape(vehiclePanel?.routeId, vehiclePanel?.directionId);
  const [following, setFollowing] = useState(true);
  const fittedVehicleId = useRef<string | undefined>(undefined);
  const skipNextFollow = useRef(false);

  const data = detail.data;
  const until = data && vehiclePanel ? stopsUntil(data.upcomingStops, vehiclePanel.stopId) : undefined;
  const targetStop = until?.target?.stop;
  const busLat = data?.vehicle.lat;
  const busLon = data?.vehicle.lon;
  const vehicleId = vehiclePanel?.vehicleId;

  // A different vehicle starts in follow mode.
  useEffect(() => {
    if (vehicleId !== undefined) setFollowing(true);
  }, [vehicleId]);

  // Fit the bus and the user's stop once per opened vehicle.
  useEffect(() => {
    if (vehicleId === undefined) {
      fittedVehicleId.current = undefined;
      return;
    }
    if (busLat === undefined || busLon === undefined) return;
    if (fittedVehicleId.current === vehicleId) return;
    fittedVehicleId.current = vehicleId;
    skipNextFollow.current = true;
    const points = [{ lat: busLat, lon: busLon }];
    if (targetStop) points.push({ lat: targetStop.lat, lon: targetStop.lon });
    mapRef.current?.fitTo(points);
  }, [vehicleId, busLat, busLon, targetStop, mapRef]);

  // Follow mode: keep the bus centered on every refresh.
  useEffect(() => {
    if (vehicleId === undefined || !following) return;
    if (busLat === undefined || busLon === undefined) return;
    if (skipNextFollow.current) {
      skipNextFollow.current = false;
      return;
    }
    mapRef.current?.panTo({ lat: busLat, lon: busLon });
  }, [vehicleId, following, busLat, busLon, mapRef]);

  let segment: RouteSegment | undefined;
  if (data && until?.target) {
    const bus = { lat: data.vehicle.lat, lon: data.vehicle.lon };
    segment = {
      coordinates: shape
        ? segmentToStop(shape, bus, until.target.stop)
        : fallbackSegment(bus, data.upcomingStops, until.remaining),
      color: routeColors(data.vehicle.routeColor, data.vehicle.routeTextColor).background,
    };
  }

  const mapContent: VehicleMapContent = {
    stops: targetStop ? [targetStop] : [],
    vehicles: data ? [data.vehicle] : [],
  };

  return {
    detail,
    mapContent,
    segment,
    following,
    follow: () => setFollowing(true),
    onUserPan: () => setFollowing(false),
  };
}
