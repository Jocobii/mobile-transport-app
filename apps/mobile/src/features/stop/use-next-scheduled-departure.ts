import type { StopTimetableResponse } from "@transit/contracts";
import { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { dateAfter, pickNextDeparture } from "./next-scheduled-departure";

export type NextScheduledDeparture =
  | { status: "idle" | "loading" | "error" }
  | { status: "ready"; responses: StopTimetableResponse[] };

interface State {
  key: string;
  result: NextScheduledDeparture;
}

const nowInSeconds = () => Math.floor(Date.now() / 1000);

/**
 * For a stop without arrivals: today's timetable and, if nothing is left today, the next
 * available day's. At most two requests, once per stop, no polling. Idle unless `enabled`.
 */
export function useNextScheduledDeparture(
  stopId: string | undefined,
  enabled: boolean,
): NextScheduledDeparture {
  const [state, setState] = useState<State | undefined>(undefined);
  const active = enabled && stopId !== undefined;

  useEffect(() => {
    if (!active || stopId === undefined) return;
    let cancelled = false;
    const finish = (result: NextScheduledDeparture) => {
      if (!cancelled) setState({ key: stopId, result });
    };
    (async () => {
      const today = await apiClient.getStopTimetable(stopId, {});
      if (pickNextDeparture([today], nowInSeconds()))
        return finish({ status: "ready", responses: [today] });
      const nextDate = dateAfter(today);
      if (nextDate === undefined) return finish({ status: "ready", responses: [today] });
      const later = await apiClient.getStopTimetable(stopId, { date: nextDate });
      return finish({ status: "ready", responses: [today, later] });
    })().catch(() => finish({ status: "error" }));
    return () => {
      cancelled = true;
    };
  }, [active, stopId]);

  if (!active) return { status: "idle" };
  return state !== undefined && state.key === stopId ? state.result : { status: "loading" };
}
