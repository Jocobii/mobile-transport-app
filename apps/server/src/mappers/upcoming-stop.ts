import type { UpcomingStopDto } from "@transit/contracts";
import type { UpcomingStopResult } from "@transit/core";
import { mapStop } from "./stop";

export function mapUpcomingStop(upcoming: UpcomingStopResult): UpcomingStopDto {
  return {
    stop: mapStop(upcoming.stop),
    stopSequence: upcoming.stopSequence,
    time: upcoming.time,
    scheduledTime: upcoming.scheduledTime,
    delaySec: upcoming.delaySec,
    source: upcoming.source,
    status: upcoming.status,
  };
}
