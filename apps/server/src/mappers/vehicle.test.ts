import type { Route, Vehicle } from "@transit/core";
import { describe, expect, it } from "vitest";
import { mapVehicle } from "./vehicle";

const ROUTE: Route = {
  id: "mvta:436",
  feedId: "mvta",
  agencyId: "mvta",
  shortName: "436",
  longName: "46th St Station-MSP-Viking Lakes-Eagan",
  color: "771473",
  textColor: "ffffff",
};

const VEHICLE: Vehicle = {
  id: "mvta:v1",
  feedId: "mvta",
  label: "101",
  lat: 44.9,
  lon: -93.2,
  routeId: "mvta:436",
  directionId: 1,
  tripId: "mvta:t1",
  headsign: "Eagan Transit Station",
  bearing: 90,
  currentStopSequence: 2,
  updatedAt: 1000,
  occupancy: "few_seats_available",
};

describe("mapVehicle", () => {
  it("maps every DTO field, using the route for routeShortName and carrying the vehicle headsign", () => {
    expect(mapVehicle(VEHICLE, ROUTE)).toEqual({
      id: "mvta:v1",
      label: "101",
      routeId: "mvta:436",
      routeShortName: "436",
      routeColor: "#771473",
      routeTextColor: "#FFFFFF",
      directionId: 1,
      headsign: "Eagan Transit Station",
      tripId: "mvta:t1",
      bearing: 90,
      updatedAt: 1000,
      occupancy: "few_seats_available",
      lat: 44.9,
      lon: -93.2,
    });
  });

  it("leaves route colors undefined when the route has none", () => {
    const dto = mapVehicle(VEHICLE, { ...ROUTE, color: undefined, textColor: undefined });
    expect(dto.routeColor).toBeUndefined();
    expect(dto.routeTextColor).toBeUndefined();
  });
});
