import { describe, expect, it } from "vitest";
import { canReuseFetchedArea, routeFilterKey } from "./area-fetch";

const FETCHED = {
  bounds: { minLat: 44.9, minLon: -93.3, maxLat: 45.0, maxLon: -93.2 },
  routeKey: "mvta:436",
};
const INSIDE = { minLat: 44.92, minLon: -93.28, maxLat: 44.98, maxLon: -93.22 };
const OUTSIDE = { minLat: 44.85, minLon: -93.28, maxLat: 44.98, maxLon: -93.22 };

describe("routeFilterKey", () => {
  it("is empty without a filter and joins the ids with commas", () => {
    expect(routeFilterKey(undefined)).toBe("");
    expect(routeFilterKey(["mvta:436", "metrotransit:68"])).toBe("mvta:436,metrotransit:68");
  });
});

describe("canReuseFetchedArea", () => {
  it("reuses the area when the visible part is inside it and the filter is the same", () => {
    expect(canReuseFetchedArea(FETCHED, INSIDE, "mvta:436")).toBe(true);
  });

  it("refetches when the visible part leaves the fetched area", () => {
    expect(canReuseFetchedArea(FETCHED, OUTSIDE, "mvta:436")).toBe(false);
  });

  it("refetches when the route filter changed, even inside the same area", () => {
    expect(canReuseFetchedArea(FETCHED, INSIDE, "")).toBe(false);
    expect(canReuseFetchedArea(FETCHED, INSIDE, "mvta:436,metrotransit:68")).toBe(false);
  });

  it("refetches when nothing was fetched yet", () => {
    expect(canReuseFetchedArea(undefined, INSIDE, "")).toBe(false);
  });
});
