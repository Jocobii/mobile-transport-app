import type { NearbyResult, Route, Stop, Vehicle } from "@transit/core";
import { describe, expect, it } from "vitest";
import { mapNearbyResult } from "./nearby";

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
const VEHICLE: Vehicle = {
  id: "metrotransit:v1",
  feedId: "metrotransit",
  lat: 44.9,
  lon: -93.2,
  routeId: "metrotransit:54",
  directionId: 0,
  tripId: "metrotransit:t1",
  headsign: "MSP - St Paul",
  updatedAt: 1000,
};

describe("mapNearbyResult", () => {
  it("maps stops, resolving each arrival/vehicle's route from that stop's routes", () => {
    const result: NearbyResult = {
      outsideRadius: false,
      feeds: [{ feedId: "metrotransit", ok: true }],
      stops: [
        {
          stop: STOP,
          distanceMeters: 42,
          routes: [ROUTE],
          nextArrivals: [
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
          approachingVehicles: [VEHICLE],
        },
      ],
    };

    const response = mapNearbyResult(result);
    expect(response.outsideRadius).toBe(false);
    expect(response.stops).toHaveLength(1);
    expect(response.stops[0]?.stop.id).toBe("56939");
    expect(response.stops[0]?.distanceMeters).toBe(42);
    expect(response.stops[0]?.nextArrivals[0]?.routeShortName).toBe("54");
    expect(response.stops[0]?.approachingVehicles[0]?.routeShortName).toBe("54");
  });
});
