import type { SearchResponse } from "@transit/contracts";
import { describe, expect, it } from "vitest";
import { toSearchSections } from "./search-sections";

const RESPONSE: SearchResponse = {
  routes: [{ id: "mvta:436", feedId: "mvta", shortName: "436", longName: "Eagan" }],
  stops: [{ id: "56939", code: "56939", name: "MSP Terminal 1", lat: 44.88, lon: -93.2 }],
};

describe("toSearchSections", () => {
  it("returns routes and stops, in that order, by default", () => {
    expect(toSearchSections(RESPONSE, false).map((section) => section.title)).toEqual([
      "search.routes",
      "search.stops",
    ]);
  });

  it("leaves the stops out for the route picker", () => {
    const sections = toSearchSections(RESPONSE, true);
    expect(sections.map((section) => section.title)).toEqual(["search.routes"]);
    expect(sections[0]?.data.every((item) => item.kind === "route")).toBe(true);
  });

  it("is empty for a picker query that only matches stops", () => {
    expect(toSearchSections({ routes: [], stops: RESPONSE.stops }, true)).toEqual([]);
  });

  it("skips empty sections", () => {
    expect(toSearchSections({ routes: [], stops: [] }, false)).toEqual([]);
  });
});
