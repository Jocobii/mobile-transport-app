import type { TransitModeDto, VehicleDto } from "@transit/contracts";

/** How a vehicle is drawn on the map. Rail modes share one shape; they differ by glyph. */
export type VehicleShape = "round" | "square";

const KNOWN_MODES: readonly TransitModeDto[] = ["bus", "brt", "lightRail", "rail"];

/**
 * The vehicle's mode, `bus` when the server sends none (older API) or one this app doesn't know
 * yet (the contract asks clients to draw unknown modes as buses).
 */
export function vehicleMode(vehicle: Pick<VehicleDto, "mode">): TransitModeDto {
  const mode = vehicle.mode;
  return mode !== undefined && KNOWN_MODES.includes(mode) ? mode : "bus";
}

export function isRailMode(mode: TransitModeDto): boolean {
  return mode === "lightRail" || mode === "rail";
}

/**
 * Map convention: buses are round, trains are square. Shape is the first cue a glance picks up,
 * and unlike the route color it does not depend on color vision or on the map behind it.
 */
export function vehicleShape(mode: TransitModeDto): VehicleShape {
  return isRailMode(mode) ? "square" : "round";
}
