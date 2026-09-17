import { describe, expect, it } from "vitest";
import type { Route } from "@transit/core";
import { mapRoute, routeShortName } from "./route";

const ROUTE: Route = {
  id: "mvta:436",
  feedId: "mvta",
  agencyId: "mvta",
  shortName: "436",
  longName: "46th St Station-MSP-Viking Lakes-Eagan",
  color: "0033A0",
  textColor: "FFFFFF",
  sortOrder: 10,
};

describe("mapRoute", () => {
  it("maps every DTO field", () => {
    expect(mapRoute(ROUTE)).toEqual({
      id: "mvta:436",
      feedId: "mvta",
      shortName: "436",
      longName: "46th St Station-MSP-Viking Lakes-Eagan",
      color: "0033A0",
      textColor: "FFFFFF",
    });
  });
});

describe("routeShortName", () => {
  it("uses shortName when present", () => {
    expect(routeShortName(ROUTE)).toBe("436");
  });

  it("falls back to longName when shortName is empty", () => {
    expect(routeShortName({ ...ROUTE, shortName: "" })).toBe(
      "46th St Station-MSP-Viking Lakes-Eagan",
    );
  });
});
