import type { VehicleDto } from "@transit/contracts";
import type { Region } from "react-native-maps";
import { outdatedPositionMinutes, secondsSince } from "@/shared/format/freshness";
import { VEHICLE_LABEL_MAX_SHOWN } from "./map-config";
import { mapRouteName, type VehicleLabelDetail } from "./vehicle-label";
import { isRailMode, vehicleMode } from "./vehicle-mode";

/** Size of the map view on screen, in dp. */
export interface MapSize {
  width: number;
  height: number;
}

/**
 * Label geometry (dp), mirrored from `VehicleMarker`'s styles so placement predicts the drawn size.
 * An estimate is enough: the margin absorbs small differences between fonts and devices.
 */
export const LABEL_GEOMETRY = {
  /** Space between the vehicle point and the bottom of its pill (`VehicleMarker` `LABEL_GAP`). */
  gapBelow: 17,
  pillHeight: 26,
  /** Horizontal padding + border of the pill, both sides. */
  pillChrome: 20,
  /** One monospace character at 13 dp. */
  charWidth: 8,
  /** Mode glyph + gap, full label only. */
  glyphWidth: 18,
  /** Divider + clock + "12 min", full label of an outdated vehicle only. */
  outdatedWidth: 58,
  /** The puck (the vehicle itself), a square around its center. */
  puckSize: 28,
  /** Minimum clear space around a label, so neighbours never touch. */
  margin: 4,
} as const;

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface Placed {
  vehicle: VehicleDto;
  x: number;
  y: number;
}

/**
 * Decides how much each vehicle's label shows, by the space around it instead of the zoom alone:
 * - **full** (glyph + route + outdated clock) when that label fits without covering another label
 *   or another vehicle;
 * - otherwise the **number** only, if that smaller label fits;
 * - otherwise **none** (the puck alone): the vehicle is in a crowd, and its label would hide others.
 * So a few scattered vehicles read in full even zoomed out, while a downtown cluster stays clean.
 *
 * Trains are placed first (fewer, the network's backbone), then the vehicles nearest the center
 * of the view (what the user is looking at), ties by id so the result is stable between polls.
 * Off-screen vehicles get no label, and at most `VEHICLE_LABEL_MAX_SHOWN` labels are drawn (every
 * label is a native snapshot, and past that many the map stops being scannable anyway).
 */
export function placeVehicleLabels(
  vehicles: readonly VehicleDto[],
  region: Region | undefined,
  size: MapSize | undefined,
  nowSeconds: number,
): Map<string, VehicleLabelDetail> {
  const details = new Map<string, VehicleLabelDetail>();
  for (const vehicle of vehicles) details.set(vehicle.id, "none");
  if (!region || !size || size.width <= 0 || size.height <= 0) return details;

  const toScreen = projection(region, size);
  const onScreen: Placed[] = [];
  for (const vehicle of vehicles) {
    const { x, y } = toScreen(vehicle.lat, vehicle.lon);
    if (x >= 0 && x <= size.width && y >= 0 && y <= size.height) onScreen.push({ vehicle, x, y });
  }

  const pucks = onScreen.map((item) => ({ id: item.vehicle.id, box: puckBox(item.x, item.y) }));
  const labels: Box[] = [];
  const center = { x: size.width / 2, y: size.height / 2 };

  for (const item of [...onScreen].sort(byPriority(center))) {
    if (labels.length >= VEHICLE_LABEL_MAX_SHOWN) break;
    const fits = (box: Box) =>
      !labels.some((other) => overlaps(box, other)) &&
      !pucks.some((puck) => puck.id !== item.vehicle.id && overlaps(box, puck.box));
    const outdated =
      outdatedPositionMinutes(secondsSince(item.vehicle.updatedAt, nowSeconds)) !== undefined;
    for (const detail of ["full", "number"] as const) {
      const box = labelBox(item, detail, outdated);
      if (fits(box)) {
        details.set(item.vehicle.id, detail);
        labels.push(box);
        break;
      }
    }
  }
  return details;
}

/** Degrees → screen dp. Linear is exact enough at the zooms where vehicles are drawn (≤ ~16 km). */
function projection(region: Region, size: MapSize) {
  const left = region.longitude - region.longitudeDelta / 2;
  const top = region.latitude + region.latitudeDelta / 2;
  return (lat: number, lon: number) => ({
    x: ((lon - left) / region.longitudeDelta) * size.width,
    y: ((top - lat) / region.latitudeDelta) * size.height,
  });
}

function byPriority(center: { x: number; y: number }) {
  return (a: Placed, b: Placed): number => {
    const railA = isRailMode(vehicleMode(a.vehicle)) ? 0 : 1;
    const railB = isRailMode(vehicleMode(b.vehicle)) ? 0 : 1;
    if (railA !== railB) return railA - railB;
    const distance = distanceSquared(a, center) - distanceSquared(b, center);
    if (distance !== 0) return distance;
    return a.vehicle.id < b.vehicle.id ? -1 : a.vehicle.id > b.vehicle.id ? 1 : 0;
  };
}

function distanceSquared(point: { x: number; y: number }, center: { x: number; y: number }) {
  return (point.x - center.x) ** 2 + (point.y - center.y) ** 2;
}

/** Estimated width (dp) of a label: pill chrome, text and, when full, the glyph and age. */
export function labelWidth(
  routeShortName: string,
  detail: Exclude<VehicleLabelDetail, "none">,
  outdated: boolean,
): number {
  const g = LABEL_GEOMETRY;
  const text = [...mapRouteName(routeShortName)].length * g.charWidth;
  if (detail === "number") return g.pillChrome + text;
  return g.pillChrome + g.glyphWidth + text + (outdated ? g.outdatedWidth : 0);
}

function labelBox(item: Placed, detail: "full" | "number", outdated: boolean): Box {
  const g = LABEL_GEOMETRY;
  const halfWidth = labelWidth(item.vehicle.routeShortName, detail, outdated) / 2 + g.margin;
  const bottom = item.y - g.gapBelow + g.margin;
  return {
    left: item.x - halfWidth,
    right: item.x + halfWidth,
    bottom,
    top: bottom - g.pillHeight - 2 * g.margin,
  };
}

function puckBox(x: number, y: number): Box {
  const half = LABEL_GEOMETRY.puckSize / 2;
  return { left: x - half, right: x + half, top: y - half, bottom: y + half };
}

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** True when both placements give every vehicle the same detail (keeps the previous Map). */
export function sameLabelDetails(
  a: ReadonlyMap<string, VehicleLabelDetail>,
  b: ReadonlyMap<string, VehicleLabelDetail>,
): boolean {
  if (a.size !== b.size) return false;
  for (const [id, detail] of a) if (b.get(id) !== detail) return false;
  return true;
}
