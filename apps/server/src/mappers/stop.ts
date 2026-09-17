import type { StopSummaryDto } from "@transit/contracts";
import type { Stop } from "@transit/core";

export function mapStop(stop: Stop): StopSummaryDto {
  return {
    id: stop.id,
    code: stop.code,
    name: stop.name,
    lat: stop.lat,
    lon: stop.lon,
  };
}
