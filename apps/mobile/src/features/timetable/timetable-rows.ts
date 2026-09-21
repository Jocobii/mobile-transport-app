import type { TimetableGroupDto } from "@transit/contracts";
import {
  type DayPart,
  findNextDeparture,
  groupTimesByDayPart,
  splitPassedTimes,
  typicalHeadwayMinutes,
} from "@/shared/format/timetable";

/** Departure times per grid row (the grid has four columns). */
export const TIMES_PER_ROW = 4;

/** Where a row sits inside its group's card, so the card border can be drawn row by row. */
export type RowEdge = "only" | "first" | "middle" | "last";

interface RowBase {
  /** Stable across `now` changes, so a row keeps its identity while the clock ticks. */
  key: string;
  edge: RowEdge;
}

/** One card is a run of rows: header, next box (today), summary, toggle, then the time grid. */
export type TimetableRow =
  | (RowBase & { kind: "header"; group: TimetableGroupDto })
  | (RowBase & {
      kind: "next";
      group: TimetableGroupDto;
      /** The next departure, or `undefined` when none is left today. */
      next: number | undefined;
    })
  | (RowBase & {
      kind: "summary";
      count: number;
      headwayMinutes: number | undefined;
      first: number | undefined;
      last: number | undefined;
    })
  | (RowBase & {
      kind: "toggle";
      groupKey: string;
      passedCount: number;
      expanded: boolean;
    })
  | (RowBase & { kind: "sectionLabel"; part: DayPart })
  | (RowBase & {
      kind: "times";
      group: TimetableGroupDto;
      times: number[];
      next: number | undefined;
      /** Departures before this instant are drawn as passed (only when the day is today). */
      passedBefore: number | undefined;
    });

export function timetableGroupKey(group: TimetableGroupDto): string {
  return `${group.routeId}:${group.directionId}:${group.headsign}`;
}

export interface BuildTimetableRowsInput {
  groups: readonly TimetableGroupDto[];
  /** Epoch seconds; only used when `isToday`. Pass it at minute granularity to keep rows stable. */
  now: number;
  isToday: boolean;
  /** Group keys whose passed departures are shown. */
  expanded: ReadonlySet<string>;
}

type RowDraft =
  | Omit<Extract<TimetableRow, { kind: "header" }>, "edge">
  | Omit<Extract<TimetableRow, { kind: "next" }>, "edge">
  | Omit<Extract<TimetableRow, { kind: "summary" }>, "edge">
  | Omit<Extract<TimetableRow, { kind: "toggle" }>, "edge">
  | Omit<Extract<TimetableRow, { kind: "sectionLabel" }>, "edge">
  | Omit<Extract<TimetableRow, { kind: "times" }>, "edge">;

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function edgeOf(index: number, count: number): RowEdge {
  if (count === 1) return "only";
  if (index === 0) return "first";
  return index === count - 1 ? "last" : "middle";
}

/**
 * Flattens the day's groups into list rows. The list virtualizes rows, so a stop with dozens of
 * routes and hundreds of departures mounts only what is on screen, instead of one heavy item per
 * route holding every departure as children.
 */
export function buildTimetableRows({
  groups,
  now,
  isToday,
  expanded,
}: BuildTimetableRowsInput): TimetableRow[] {
  const rows: TimetableRow[] = [];

  for (const group of groups) {
    const groupKey = timetableGroupKey(group);
    const next = isToday ? findNextDeparture(group.times, now) : undefined;
    const passed = isToday ? splitPassedTimes(group.times, now).passed : [];
    const hidePassed = isToday && !expanded.has(groupKey);

    const drafts: RowDraft[] = [{ kind: "header", key: `${groupKey}:header`, group }];
    if (isToday) drafts.push({ kind: "next", key: `${groupKey}:next`, group, next });
    drafts.push({
      kind: "summary",
      key: `${groupKey}:summary`,
      count: group.times.length,
      headwayMinutes: typicalHeadwayMinutes(group.times),
      first: group.times[0],
      last: group.times[group.times.length - 1],
    });
    if (passed.length > 0) {
      drafts.push({
        kind: "toggle",
        key: `${groupKey}:toggle`,
        groupKey,
        passedCount: passed.length,
        expanded: !hidePassed,
      });
    }

    for (const section of groupTimesByDayPart(group.times)) {
      const times = hidePassed ? section.times.filter((time) => time >= now) : section.times;
      if (times.length === 0) continue;
      drafts.push({
        kind: "sectionLabel",
        key: `${groupKey}:label:${section.part}`,
        part: section.part,
      });
      chunk(times, TIMES_PER_ROW).forEach((rowTimes, index) => {
        drafts.push({
          kind: "times",
          key: `${groupKey}:times:${section.part}:${index}`,
          group,
          times: rowTimes,
          next,
          passedBefore: isToday ? now : undefined,
        });
      });
    }

    drafts.forEach((draft, index) => {
      rows.push({ ...draft, edge: edgeOf(index, drafts.length) } as TimetableRow);
    });
  }

  return rows;
}
