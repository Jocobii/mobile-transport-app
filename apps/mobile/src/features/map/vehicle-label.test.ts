import { describe, expect, it } from "vitest";
import { MAP_ROUTE_NAME_MAX_CHARS } from "./map-config";
import { mapRouteName } from "./vehicle-label";

describe("mapRouteName", () => {
  it("keeps short names", () => {
    expect(mapRouteName("436")).toBe("436");
    expect(mapRouteName("12345678")).toBe("12345678");
  });

  it("cuts long names to the limit with an ellipsis", () => {
    const cut = mapRouteName("METRO B Line");
    expect(cut).toBe("METRO B…");
    expect([...cut]).toHaveLength(MAP_ROUTE_NAME_MAX_CHARS);
  });

  it("does not leave a space before the ellipsis", () => {
    expect(mapRouteName("Orange Line")).toBe("Orange…");
  });
});
