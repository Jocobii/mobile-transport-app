import type { StopTimetableResponse, TimetableGroupDto } from "@transit/contracts";
import { describe, expect, it } from "vitest";
import {
  dateAfter,
  pickNextDeparture,
  routesOf,
  summarizeEmptyStop,
} from "./next-scheduled-departure";

function group(routeId: string, times: number[], directionId: 0 | 1 = 0): TimetableGroupDto {
  return { routeId, routeShortName: routeId, directionId, headsign: `to ${routeId}`, times };
}

function timetable(
  serviceDate: string,
  groups: TimetableGroupDto[],
  availableDates: string[] = ["20260920", "20260921"],
): StopTimetableResponse {
  return {
    stop: { id: "s1", code: "1", name: "Stop", lat: 0, lon: 0, feedIds: ["f"] },
    serviceDate,
    today: "20260920",
    availableDates,
    groups,
  } as unknown as StopTimetableResponse;
}

const NOW = 1000;

describe("pickNextDeparture", () => {
  it("returns the earliest departure of today that is still ahead, across groups", () => {
    const today = timetable("20260920", [group("54", [1500, 2000]), group("63", [1200])]);

    const next = pickNextDeparture([today], NOW);

    expect(next).toMatchObject({ time: 1200, today: true, route: { routeId: "63" } });
  });

  it("ignores departures before now", () => {
    const today = timetable("20260920", [group("54", [100, 900, 1800])]);

    expect(pickNextDeparture([today], NOW)?.time).toBe(1800);
  });

  it("falls to the next day when nothing is left today", () => {
    const today = timetable("20260920", [group("54", [100, 900])]);
    const tomorrow = timetable("20260921", [group("54", [5000])]);

    const next = pickNextDeparture([today, tomorrow], NOW);

    expect(next).toMatchObject({ time: 5000, serviceDate: "20260921", today: false });
  });

  it("returns undefined when no timetable has a departure ahead", () => {
    const today = timetable("20260920", [group("54", [100])]);

    expect(pickNextDeparture([today, timetable("20260921", [])], NOW)).toBeUndefined();
  });

  it("returns undefined without timetables", () => {
    expect(pickNextDeparture([], NOW)).toBeUndefined();
  });
});

describe("routesOf", () => {
  it("lists each route once, in delivered order", () => {
    const response = timetable("20260920", [
      group("63", [1]),
      group("54", [1], 0),
      group("54", [2], 1),
    ]);

    expect(routesOf(response).map((route) => route.routeId)).toEqual(["63", "54"]);
  });
});

describe("summarizeEmptyStop", () => {
  it("takes the routes of the day that has the next departure", () => {
    const today = timetable("20260920", [group("54", [100])]);
    const tomorrow = timetable("20260921", [group("63", [5000])]);

    const summary = summarizeEmptyStop([today, tomorrow], NOW);

    expect(summary.routes.map((route) => route.routeId)).toEqual(["63"]);
  });

  it("falls back to today's routes when there is no next departure", () => {
    const today = timetable("20260920", [group("54", [100])]);

    const summary = summarizeEmptyStop([today], NOW);

    expect(summary.next).toBeUndefined();
    expect(summary.routes.map((route) => route.routeId)).toEqual(["54"]);
  });
});

describe("dateAfter", () => {
  it("returns the first available date after the response's day", () => {
    expect(dateAfter(timetable("20260920", []))).toBe("20260921");
  });

  it("returns undefined at the end of the catalog", () => {
    expect(dateAfter(timetable("20260921", []))).toBeUndefined();
  });
});
