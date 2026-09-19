import { describe, expect, it } from "vitest";
import {
  activeRouteIds,
  DEFAULT_ROUTE_FILTER,
  type FilterRoute,
  isFilterFull,
  isRouteSelected,
  MAX_FILTER_ROUTES,
  type RouteFilter,
  removeRoute,
  setFilterEnabled,
  toFilterRoute,
  toggleRoute,
} from "./route-filter";

const R68: FilterRoute = { id: "metrotransit:68", shortName: "68", color: "#5B2C83" };
const R345: FilterRoute = { id: "metrotransit:345", shortName: "345" };
const R436: FilterRoute = { id: "mvta:436", shortName: "436", color: "#E87722" };

function filterWith(routes: FilterRoute[], enabled: boolean): RouteFilter {
  return { enabled, routes };
}

function fullFilter(): RouteFilter {
  const routes = Array.from({ length: MAX_FILTER_ROUTES }, (_, index) => ({
    id: `f:${index}`,
    shortName: String(index),
  }));
  return filterWith(routes, true);
}

describe("toFilterRoute", () => {
  it("keeps only what a badge needs", () => {
    expect(
      toFilterRoute({
        id: "mvta:436",
        feedId: "mvta",
        shortName: "436",
        longName: "46th St Station - Eagan",
        color: "#E87722",
        textColor: "#FFFFFF",
      }),
    ).toEqual({ id: "mvta:436", shortName: "436", color: "#E87722", textColor: "#FFFFFF" });
  });
});

describe("toggleRoute", () => {
  it("adding the first route turns the filter on", () => {
    expect(toggleRoute(DEFAULT_ROUTE_FILTER, R68)).toEqual(filterWith([R68], true));
  });

  it("adding a later route keeps the switch as it is", () => {
    expect(toggleRoute(filterWith([R68], true), R345)).toEqual(filterWith([R68, R345], true));
    expect(toggleRoute(filterWith([R68], false), R345)).toEqual(filterWith([R68, R345], false));
  });

  it("toggling a selected route removes it", () => {
    expect(toggleRoute(filterWith([R68, R345], true), R68)).toEqual(filterWith([R345], true));
  });

  it("removing the last route turns the filter off", () => {
    expect(toggleRoute(filterWith([R68], true), R68)).toEqual(filterWith([], false));
  });

  it("ignores an addition when the list is full, but still allows removal", () => {
    const full = fullFilter();
    expect(toggleRoute(full, R68)).toBe(full);
    const firstId = full.routes[0]?.id ?? "";
    const smaller = toggleRoute(full, full.routes[0] as FilterRoute);
    expect(smaller.routes).toHaveLength(MAX_FILTER_ROUTES - 1);
    expect(isRouteSelected(smaller, firstId)).toBe(false);
  });
});

describe("removeRoute", () => {
  it("returns the same filter when the route is not selected", () => {
    const filter = filterWith([R68], true);
    expect(removeRoute(filter, "nope")).toBe(filter);
  });

  it("keeps a disabled filter disabled", () => {
    expect(removeRoute(filterWith([R68, R345], false), R68.id)).toEqual(filterWith([R345], false));
  });
});

describe("setFilterEnabled", () => {
  it("cannot enable an empty list", () => {
    expect(setFilterEnabled(DEFAULT_ROUTE_FILTER, true)).toBe(DEFAULT_ROUTE_FILTER);
  });

  it("switches a non-empty list on and off", () => {
    expect(setFilterEnabled(filterWith([R68], false), true)).toEqual(filterWith([R68], true));
    expect(setFilterEnabled(filterWith([R68], true), false)).toEqual(filterWith([R68], false));
  });

  it("returns the same filter when nothing changes", () => {
    const filter = filterWith([R68], true);
    expect(setFilterEnabled(filter, true)).toBe(filter);
  });
});

describe("activeRouteIds", () => {
  it("is undefined when the filter is off or empty", () => {
    expect(activeRouteIds(filterWith([R68], false))).toBeUndefined();
    expect(activeRouteIds(DEFAULT_ROUTE_FILTER)).toBeUndefined();
  });

  it("lists the route ids in order when the filter is on", () => {
    expect(activeRouteIds(filterWith([R68, R345, R436], true))).toEqual([
      "metrotransit:68",
      "metrotransit:345",
      "mvta:436",
    ]);
  });
});

describe("isFilterFull", () => {
  it("is true only at the maximum", () => {
    expect(isFilterFull(fullFilter())).toBe(true);
    expect(isFilterFull(filterWith([R68], true))).toBe(false);
  });
});
