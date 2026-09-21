import type { TimetableGroupDto } from "@transit/contracts";
import { describe, expect, it } from "vitest";
import { buildTimetableRows, TIMES_PER_ROW, timetableGroupKey } from "./timetable-rows";

const MINUTE = 60;
// 2026-09-21 06:00 local-independent base; only relative order matters for these tests.
const BASE = Date.UTC(2026, 8, 21, 12, 0, 0) / 1000;

function group(times: number[], overrides: Partial<TimetableGroupDto> = {}): TimetableGroupDto {
  return {
    routeId: "mt:68",
    routeShortName: "68",
    directionId: 0,
    headsign: "Downtown",
    times,
    ...overrides,
  };
}

function minutes(...offsets: number[]): number[] {
  return offsets.map((offset) => BASE + offset * MINUTE);
}

const NONE = new Set<string>();

describe("buildTimetableRows", () => {
  it("returns no rows without groups", () => {
    expect(buildTimetableRows({ groups: [], now: BASE, isToday: true, expanded: NONE })).toEqual(
      [],
    );
  });

  it("starts a group with header, next and summary rows today", () => {
    const rows = buildTimetableRows({
      groups: [group(minutes(0, 10, 20))],
      now: BASE - MINUTE,
      isToday: true,
      expanded: NONE,
    });
    expect(rows.slice(0, 3).map((row) => row.kind)).toEqual(["header", "next", "summary"]);
  });

  it("has no next row on another day", () => {
    const rows = buildTimetableRows({
      groups: [group(minutes(0, 10, 20))],
      now: BASE,
      isToday: false,
      expanded: NONE,
    });
    expect(rows.map((row) => row.kind)).not.toContain("next");
  });

  it("packs departures four per row", () => {
    const times = minutes(0, 1, 2, 3, 4, 5, 6, 7, 8);
    const rows = buildTimetableRows({
      groups: [group(times)],
      now: BASE,
      isToday: false,
      expanded: NONE,
    });
    const timeRows = rows.flatMap((row) => (row.kind === "times" ? [row.times] : []));
    expect(timeRows.map((row) => row.length)).toEqual([TIMES_PER_ROW, TIMES_PER_ROW, 1]);
    expect(timeRows.flat()).toEqual(times);
  });

  it("hides passed departures behind a toggle and counts them", () => {
    const rows = buildTimetableRows({
      groups: [group(minutes(0, 10, 20, 30))],
      now: BASE + 15 * MINUTE,
      isToday: true,
      expanded: NONE,
    });
    const toggle = rows.find((row) => row.kind === "toggle");
    expect(toggle).toMatchObject({ passedCount: 2, expanded: false });
    const shown = rows.flatMap((row) => (row.kind === "times" ? row.times : []));
    expect(shown).toEqual(minutes(20, 30));
  });

  it("shows passed departures when the group is expanded", () => {
    const g = group(minutes(0, 10, 20, 30));
    const rows = buildTimetableRows({
      groups: [g],
      now: BASE + 15 * MINUTE,
      isToday: true,
      expanded: new Set([timetableGroupKey(g)]),
    });
    expect(rows.find((row) => row.kind === "toggle")).toMatchObject({ expanded: true });
    const shown = rows.flatMap((row) => (row.kind === "times" ? row.times : []));
    expect(shown).toEqual(minutes(0, 10, 20, 30));
  });

  it("omits the toggle when nothing has passed", () => {
    const rows = buildTimetableRows({
      groups: [group(minutes(10, 20))],
      now: BASE,
      isToday: true,
      expanded: NONE,
    });
    expect(rows.map((row) => row.kind)).not.toContain("toggle");
  });

  it("marks the next departure on the next and times rows", () => {
    const rows = buildTimetableRows({
      groups: [group(minutes(0, 10, 20))],
      now: BASE + 5 * MINUTE,
      isToday: true,
      expanded: NONE,
    });
    const nextRow = rows.find((row) => row.kind === "next");
    expect(nextRow).toMatchObject({ next: BASE + 10 * MINUTE });
    const timesRow = rows.find((row) => row.kind === "times");
    expect(timesRow).toMatchObject({ next: BASE + 10 * MINUTE });
  });

  it("has an undefined next when every departure has passed", () => {
    const rows = buildTimetableRows({
      groups: [group(minutes(0, 10))],
      now: BASE + 60 * MINUTE,
      isToday: true,
      expanded: NONE,
    });
    expect(rows.find((row) => row.kind === "next")).toMatchObject({ next: undefined });
    expect(rows.map((row) => row.kind)).not.toContain("times");
  });

  it("draws the card edge row by row and closes each group", () => {
    const rows = buildTimetableRows({
      groups: [group(minutes(0, 10)), group(minutes(5), { routeId: "mt:5", headsign: "Uptown" })],
      now: BASE,
      isToday: false,
      expanded: NONE,
    });
    const firstGroup = rows.filter((row) => row.key.startsWith("mt:68"));
    expect(firstGroup[0]?.edge).toBe("first");
    expect(firstGroup[firstGroup.length - 1]?.edge).toBe("last");
    expect(firstGroup.slice(1, -1).every((row) => row.edge === "middle")).toBe(true);
  });

  it("gives every row a unique, stable key", () => {
    const input = {
      groups: [group(minutes(0, 1, 2, 3, 4, 5)), group(minutes(2), { routeId: "mt:5" })],
      isToday: true,
      expanded: NONE,
    };
    const before = buildTimetableRows({ ...input, now: BASE - 60 });
    const after = buildTimetableRows({ ...input, now: BASE - 30 });
    const keys = before.map((row) => row.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(after.map((row) => row.key)).toEqual(keys);
  });
});
