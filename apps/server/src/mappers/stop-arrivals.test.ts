import { describe, expect, it } from "vitest";
import type { Route, Stop, StopArrivalsResult } from "@transit/core";
import { mapStopArrivalsResult } from "./stop-arrivals";

const STOP: Stop = {
  id: "56939",
  code: "56939",
  name: "MSP T1",
  lat: 44.88,
  lon: -93.2,
  feedIds: [],
};
const ROUTE: Route = {
  id: "metrotransit:54",
  feedId: "metrotransit",
  agencyId: "metrotransit",
  shortName: "54",
  longName: "MSP - St Paul",
};

describe("mapStopArrivalsResult", () => {
  it("maps stop, routes and arrivals with resolved route info", () => {
    const result: StopArrivalsResult = {
      stop: STOP,
      routes: [ROUTE],
      feeds: [{ feedId: "metrotransit", ok: true }],
      arrivals: [
        {
          stopId: STOP.id,
          routeId: ROUTE.id,
          directionId: 0,
          tripId: "metrotransit:t1",
          headsign: "Downtown",
          time: 1000,
          source: "scheduled",
          status: "normal",
        },
      ],
    };
    const response = mapStopArrivalsResult(result);
    expect(response.stop.id).toBe("56939");
    expect(response.routes.map((r) => r.id)).toEqual(["metrotransit:54"]);
    expect(response.arrivals[0]?.routeShortName).toBe("54");
    expect(response.feeds[0]?.feedId).toBe("metrotransit");
  });
});
