import { describe, expect, it } from "vitest";
import { nearbyEmptyKey } from "./nearby-empty";

describe("nearbyEmptyKey", () => {
  it("says there are no stops when none were found", () => {
    expect(nearbyEmptyKey(0, false)).toBe("empty");
  });

  it("says there are no departures when stops exist but have none", () => {
    expect(nearbyEmptyKey(3, false)).toBe("emptyRoutes");
  });

  it("points at the route filter whenever it is on", () => {
    expect(nearbyEmptyKey(0, true)).toBe("emptyFiltered");
    expect(nearbyEmptyKey(3, true)).toBe("emptyFiltered");
  });
});
