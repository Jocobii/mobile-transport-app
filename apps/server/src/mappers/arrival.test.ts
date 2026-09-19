import type { Arrival, Route } from "@transit/core";
import { describe, expect, it } from "vitest";
import { mapArrival } from "./arrival";

const ROUTE: Route = {
  id: "metrotransit:54",
  feedId: "metrotransit",
  agencyId: "metrotransit",
  shortName: "54",
  longName: "MSP - St Paul",
  color: "0033a0",
  textColor: "FFFFFF",
};

const ARRIVAL: Arrival = {
  stopId: "56939",
  routeId: "metrotransit:54",
  directionId: 0,
  tripId: "metrotransit:t1",
  headsign: "Downtown",
  stopSequence: 3,
  time: 1000,
  scheduledTime: 950,
  delaySec: 50,
  source: "live",
  status: "normal",
  vehicleId: "metrotransit:v1",
};

describe("mapArrival", () => {
  it("maps every DTO field, using the route for routeShortName/routeColor", () => {
    expect(mapArrival(ARRIVAL, ROUTE)).toEqual({
      tripId: "metrotransit:t1",
      routeId: "metrotransit:54",
      routeShortName: "54",
      routeColor: "#0033A0",
      routeTextColor: "#FFFFFF",
      directionId: 0,
      headsign: "Downtown",
      time: 1000,
      scheduledTime: 950,
      delaySec: 50,
      source: "live",
      status: "normal",
      vehicleId: "metrotransit:v1",
    });
  });

  it("leaves route colors undefined when the route has none", () => {
    const dto = mapArrival(ARRIVAL, { ...ROUTE, color: undefined, textColor: undefined });
    expect(dto.routeColor).toBeUndefined();
    expect(dto.routeTextColor).toBeUndefined();
  });
});
