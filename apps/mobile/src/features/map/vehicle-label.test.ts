import { describe, expect, it } from "vitest";
import {
  MAP_ROUTE_NAME_MAX_CHARS,
  VEHICLE_LABEL_FULL_MAX_DELTA,
  VEHICLE_LABEL_NUMBER_MAX_DELTA,
} from "./map-config";
import { mapRouteName, vehicleLabelDetail } from "./vehicle-label";

describe("vehicleLabelDetail", () => {
  it("shows the full label when zoomed in", () => {
    expect(vehicleLabelDetail(VEHICLE_LABEL_FULL_MAX_DELTA)).toBe("full");
  });

  it("shows only the number at mid zoom", () => {
    expect(vehicleLabelDetail(VEHICLE_LABEL_FULL_MAX_DELTA + 0.001)).toBe("number");
    expect(vehicleLabelDetail(VEHICLE_LABEL_NUMBER_MAX_DELTA)).toBe("number");
  });

  it("hides the label when zoomed out", () => {
    expect(vehicleLabelDetail(VEHICLE_LABEL_NUMBER_MAX_DELTA + 0.001)).toBe("none");
  });

  it("shows the number before the map reports a region", () => {
    expect(vehicleLabelDetail(undefined)).toBe("number");
  });
});

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
