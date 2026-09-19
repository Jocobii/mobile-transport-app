import type { StopSummaryDto } from "@transit/contracts";
import { useCallback, useEffect, useState } from "react";
import { type StopTimetableQuery, useStopTimetable } from "./use-stop-timetable";

interface DateChoice {
  stopId: string;
  date: string;
}

/** What stays on screen while another day loads: the stop and the days the rider can pick. */
export interface TimetableDays {
  stop: StopSummaryDto;
  today: string;
  availableDates: string[];
}

export interface TimetableView extends StopTimetableQuery {
  /** The day the rider picked; `undefined` means the server default (today). */
  selectedDate: string | undefined;
  selectDate: (date: string) => void;
  /** From the latest response of this stop; `undefined` until the first one arrives. */
  days: TimetableDays | undefined;
}

/**
 * Timetable query plus the selected day. The choice belongs to one stop: opening the timetable
 * of another stop starts again on today, without a wasted request for the old date.
 */
export function useTimetableView(stopId: string | undefined): TimetableView {
  const [choice, setChoice] = useState<DateChoice | undefined>(undefined);
  const [known, setKnown] = useState<(TimetableDays & { stopId: string }) | undefined>(undefined);
  const selectedDate = choice !== undefined && choice.stopId === stopId ? choice.date : undefined;
  const query = useStopTimetable(stopId, selectedDate);

  const data = query.data;
  useEffect(() => {
    if (stopId === undefined || data === undefined) return;
    setKnown({
      stopId,
      stop: data.stop,
      today: data.today,
      availableDates: data.availableDates,
    });
  }, [stopId, data]);

  const selectDate = useCallback(
    (date: string) => {
      if (stopId !== undefined) setChoice({ stopId, date });
    },
    [stopId],
  );

  const days = known !== undefined && known.stopId === stopId ? known : undefined;
  return { ...query, selectedDate, selectDate, days };
}
