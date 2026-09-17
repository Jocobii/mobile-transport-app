import type { Route, RouteDetailResult, Stop } from "@transit/core";
import { describe, expect, it } from "vitest";
import { mapRouteDetailResult } from "./route-detail";

describe("mapRouteDetailResult", () => {
  it("maps route, directions, selected direction, stops and shape", () => {
    const route: Route = {
      id: "mvta:436",
      feedId: "mvta",
      agencyId: "mvta",
      shortName: "436",
      longName: "46th St Station-MSP-Viking Lakes-Eagan",
    };
    const stop: Stop = {
      id: "eagan",
      code: "eagan",
      name: "Eagan Transit Station",
      lat: 44.8,
      lon: -93.16,
      feedIds: [],
    };
    const result: RouteDetailResult = {
      route,
      directions: [
        { directionId: 0, headsign: "MSP" },
        { directionId: 1, headsign: "Eagan Transit Station" },
      ],
      selectedDirectionId: 1,
      stops: [stop],
      shape: [{ lat: 44.8, lon: -93.16 }],
    };
    const response = mapRouteDetailResult(result);
    expect(response.route.id).toBe("mvta:436");
    expect(response.directions).toEqual([
      { directionId: 0, headsign: "MSP" },
      { directionId: 1, headsign: "Eagan Transit Station" },
    ]);
    expect(response.selectedDirectionId).toBe(1);
    expect(response.stops.map((s) => s.id)).toEqual(["eagan"]);
    expect(response.shape).toEqual([{ lat: 44.8, lon: -93.16 }]);
  });
});
