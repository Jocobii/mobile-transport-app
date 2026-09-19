import { describe, expect, it } from "vitest";
import type { Route, ScheduledStopTime } from "../model";
import { groupTimetable } from "./timetable";

function route(id: string): Route {
  return {
    id,
    feedId: id.split(":")[0] ?? "",
    agencyId: "a",
    shortName: id.split(":")[1] ?? "",
    longName: "",
  };
}

function row(overrides: Partial<ScheduledStopTime> = {}): ScheduledStopTime {
  return {
    tripId: "t1",
    routeId: "metrotransit:54",
    directionId: 0,
    headsign: "Downtown",
    stopId: "s1",
    stopSequence: 1,
    serviceDate: "20260919",
    time: 1000,
    ...overrides,
  };
}

const ROUTES = [route("metrotransit:9"), route("metrotransit:54"), route("mvta:436")];

describe("groupTimetable", () => {
  it("returns no groups for no departures", () => {
    expect(groupTimetable([], ROUTES)).toEqual([]);
  });

  it("groups by route, direction and headsign", () => {
    const groups = groupTimetable(
      [
        row({ time: 100 }),
        row({ time: 200, directionId: 1, headsign: "Airport" }),
        row({ time: 300 }),
        row({ time: 400, headsign: "Downtown Express" }),
      ],
      ROUTES,
    );
    expect(groups.map((g) => [g.directionId, g.headsign, g.times])).toEqual([
      [0, "Downtown", [100, 300]],
      [0, "Downtown Express", [400]],
      [1, "Airport", [200]],
    ]);
  });

  it("orders groups by route naturally, then direction, then headsign", () => {
    const groups = groupTimetable(
      [
        row({ routeId: "mvta:436", time: 1 }),
        row({ routeId: "metrotransit:54", time: 2 }),
        row({ routeId: "metrotransit:9", time: 3 }),
        row({ routeId: "metrotransit:9", directionId: 1, headsign: "B", time: 4 }),
        row({ routeId: "metrotransit:9", directionId: 1, headsign: "A", time: 5 }),
      ],
      ROUTES,
    );
    expect(groups.map((g) => `${g.route.id}/${g.directionId}/${g.headsign}`)).toEqual([
      "metrotransit:9/0/Downtown",
      "metrotransit:9/1/A",
      "metrotransit:9/1/B",
      "metrotransit:54/0/Downtown",
      "mvta:436/0/Downtown",
    ]);
  });

  it("sorts times ascending and collapses duplicates", () => {
    const [group] = groupTimetable(
      [row({ time: 300 }), row({ time: 100 }), row({ time: 300 }), row({ time: 200 })],
      ROUTES,
    );
    expect(group?.times).toEqual([100, 200, 300]);
  });

  it("drops departures whose route is unknown", () => {
    const groups = groupTimetable(
      [row({ routeId: "metrotransit:999" }), row({ routeId: "metrotransit:54" })],
      ROUTES,
    );
    expect(groups.map((g) => g.route.id)).toEqual(["metrotransit:54"]);
  });
});
