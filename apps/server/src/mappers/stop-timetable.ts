import type { StopTimetableResponse } from "@transit/contracts";
import type { StopTimetableResult } from "@transit/core";
import { normalizeHexColor } from "./color";
import { routeShortName } from "./route";
import { mapStop } from "./stop";

export function mapStopTimetableResult(result: StopTimetableResult): StopTimetableResponse {
  return {
    stop: mapStop(result.stop),
    serviceDate: result.serviceDate,
    today: result.today,
    availableDates: result.availableDates,
    groups: result.groups.map((group) => ({
      routeId: group.route.id,
      routeShortName: routeShortName(group.route),
      routeColor: normalizeHexColor(group.route.color),
      routeTextColor: normalizeHexColor(group.route.textColor),
      directionId: group.directionId,
      headsign: group.headsign,
      times: group.times,
    })),
  };
}
