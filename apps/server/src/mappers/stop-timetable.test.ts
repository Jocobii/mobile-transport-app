import type { StopTimetableResult } from "@transit/core";
import { describe, expect, it } from "vitest";
import { mapStopTimetableResult } from "./stop-timetable";

const RESULT: StopTimetableResult = {
  stop: {
    id: "56939",
    code: "56939",
    name: "MSP Terminal 1",
    lat: 44.880248,
    lon: -93.204865,
    feedIds: ["metrotransit"],
  },
  serviceDate: "20260920",
  today: "20260919",
  availableDates: ["20260919", "20260920"],
  groups: [
    {
      route: {
        id: "metrotransit:54",
        feedId: "metrotransit",
        agencyId: "metrotransit",
        shortName: "54",
        longName: "MSP - St Paul",
        color: "0033a0",
        textColor: "ffffff",
      },
      directionId: 1,
      headsign: "Downtown",
      times: [1000, 2000],
    },
    {
      route: {
        id: "metrotransit:blue",
        feedId: "metrotransit",
        agencyId: "metrotransit",
        shortName: "",
        longName: "METRO Blue Line",
      },
      directionId: 0,
      headsign: "Mall of America",
      times: [3000],
    },
  ],
};

describe("mapStopTimetableResult", () => {
  it("maps the stop, dates and groups", () => {
    const response = mapStopTimetableResult(RESULT);

    expect(response.stop).toEqual({
      id: "56939",
      code: "56939",
      name: "MSP Terminal 1",
      lat: 44.880248,
      lon: -93.204865,
    });
    expect(response.serviceDate).toBe("20260920");
    expect(response.today).toBe("20260919");
    expect(response.availableDates).toEqual(["20260919", "20260920"]);
  });

  it("normalizes route colors and preserves epoch times", () => {
    const [first] = mapStopTimetableResult(RESULT).groups;
    expect(first).toEqual({
      routeId: "metrotransit:54",
      routeShortName: "54",
      routeColor: "#0033A0",
      routeTextColor: "#FFFFFF",
      directionId: 1,
      headsign: "Downtown",
      times: [1000, 2000],
    });
  });

  it("falls back to the long name and leaves missing colors undefined", () => {
    const second = mapStopTimetableResult(RESULT).groups[1];
    expect(second?.routeShortName).toBe("METRO Blue Line");
    expect(second?.routeColor).toBeUndefined();
    expect(second?.routeTextColor).toBeUndefined();
  });

  it("maps an empty timetable", () => {
    const response = mapStopTimetableResult({ ...RESULT, groups: [], availableDates: [] });
    expect(response.groups).toEqual([]);
    expect(response.availableDates).toEqual([]);
  });
});
