import type { Route, SearchResult, Stop } from "@transit/core";
import { describe, expect, it } from "vitest";
import { mapSearchResult } from "./search";

describe("mapSearchResult", () => {
  it("maps routes and stops", () => {
    const route: Route = {
      id: "mvta:436",
      feedId: "mvta",
      agencyId: "mvta",
      shortName: "436",
      longName: "46th St Station-MSP-Viking Lakes-Eagan",
    };
    const stop: Stop = {
      id: "56939",
      code: "56939",
      name: "MSP T1",
      lat: 44.88,
      lon: -93.2,
      feedIds: [],
    };
    const result: SearchResult = { routes: [route], stops: [stop] };
    const response = mapSearchResult(result);
    expect(response.routes.map((r) => r.id)).toEqual(["mvta:436"]);
    expect(response.stops.map((s) => s.id)).toEqual(["56939"]);
  });
});
