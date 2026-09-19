import { describe, expect, it } from "vitest";
import { MAX_FILTER_ROUTES } from "./route-filter";
import { parseStoredRouteFilter } from "./route-filter-storage";

const DEFAULTS = { enabled: false, routes: [] };

describe("parseStoredRouteFilter", () => {
  it("returns the defaults when nothing is stored yet", () => {
    expect(parseStoredRouteFilter(null)).toEqual(DEFAULTS);
  });

  it("round-trips a valid stored value", () => {
    const stored = {
      enabled: true,
      routes: [
        { id: "metrotransit:68", shortName: "68", color: "#5B2C83", textColor: "#FFFFFF" },
        { id: "mvta:436", shortName: "436" },
      ],
    };
    expect(parseStoredRouteFilter(JSON.stringify(stored))).toEqual({
      enabled: true,
      routes: [
        { id: "metrotransit:68", shortName: "68", color: "#5B2C83", textColor: "#FFFFFF" },
        { id: "mvta:436", shortName: "436", color: undefined, textColor: undefined },
      ],
    });
  });

  it("returns the defaults for invalid JSON or a non-object value", () => {
    expect(parseStoredRouteFilter("{not json")).toEqual(DEFAULTS);
    expect(parseStoredRouteFilter("42")).toEqual(DEFAULTS);
    expect(parseStoredRouteFilter("null")).toEqual(DEFAULTS);
  });

  it("drops malformed routes and keeps the valid ones", () => {
    const raw = JSON.stringify({
      enabled: true,
      routes: [
        { id: "a", shortName: "1" },
        { id: 7, shortName: "2" },
        { id: "", shortName: "3" },
        { id: "b" },
        "nope",
        null,
        { id: "c", shortName: "4", color: 5 },
      ],
    });
    expect(parseStoredRouteFilter(raw)).toEqual({
      enabled: true,
      routes: [
        { id: "a", shortName: "1", color: undefined, textColor: undefined },
        { id: "c", shortName: "4", color: undefined, textColor: undefined },
      ],
    });
  });

  it("drops repeated ids", () => {
    const raw = JSON.stringify({
      enabled: true,
      routes: [
        { id: "a", shortName: "1" },
        { id: "a", shortName: "1" },
      ],
    });
    expect(parseStoredRouteFilter(raw).routes).toHaveLength(1);
  });

  it("cuts the list to the maximum", () => {
    const routes = Array.from({ length: MAX_FILTER_ROUTES + 3 }, (_, index) => ({
      id: `r${index}`,
      shortName: String(index),
    }));
    expect(parseStoredRouteFilter(JSON.stringify({ enabled: true, routes })).routes).toHaveLength(
      MAX_FILTER_ROUTES,
    );
  });

  it("is never enabled without routes, and enabled must be exactly true", () => {
    expect(parseStoredRouteFilter('{"enabled":true,"routes":[]}')).toEqual(DEFAULTS);
    expect(parseStoredRouteFilter('{"enabled":true}')).toEqual(DEFAULTS);
    expect(
      parseStoredRouteFilter('{"enabled":"yes","routes":[{"id":"a","shortName":"1"}]}').enabled,
    ).toBe(false);
  });
});
