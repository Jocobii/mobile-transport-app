import { describe, expect, it } from "vitest";
import { MAX_FILTER_ROUTES, type RouteFilter } from "@/features/map/route-filter";
import { pickerRowState } from "./route-picker";

function filterOf(count: number): RouteFilter {
  return {
    enabled: true,
    routes: Array.from({ length: count }, (_, index) => ({
      id: `f:${index}`,
      shortName: String(index),
    })),
  };
}

describe("pickerRowState", () => {
  it("marks selected routes", () => {
    expect(pickerRowState("f:1", filterOf(3))).toEqual({ selected: true, disabled: false });
  });

  it("leaves unselected routes enabled while there is room", () => {
    expect(pickerRowState("other", filterOf(3))).toEqual({ selected: false, disabled: false });
  });

  it("disables unselected routes when the filter is full but keeps selected ones removable", () => {
    const full = filterOf(MAX_FILTER_ROUTES);
    expect(pickerRowState("other", full)).toEqual({ selected: false, disabled: true });
    expect(pickerRowState("f:0", full)).toEqual({ selected: true, disabled: false });
  });
});
