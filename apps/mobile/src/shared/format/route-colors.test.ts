import { describe, expect, it } from "vitest";
import { routeColors } from "./route-colors";

describe("routeColors", () => {
  it("uses both official colors when present", () => {
    expect(routeColors("#771473", "#FFDF52")).toEqual({ background: "#771473", text: "#FFDF52" });
  });

  it("uses white text when only the background is present", () => {
    expect(routeColors("#771473")).toEqual({ background: "#771473", text: "#FFFFFF" });
  });

  it("falls back to ink and white when the color is missing", () => {
    expect(routeColors()).toEqual({ background: "#1D1D1B", text: "#FFFFFF" });
  });

  it("ignores the text color when the background is missing", () => {
    expect(routeColors(undefined, "#000000")).toEqual({ background: "#1D1D1B", text: "#FFFFFF" });
  });
});
