import { describe, expect, it } from "vitest";
import { resolveBackAction } from "./back-decision";

describe("resolveBackAction", () => {
  it("clears the highlighted stop in Nearby when one is set", () => {
    expect(resolveBackAction("nearby", true, false, false)).toBe("clearHighlightedStop");
  });

  it("exits the app in Nearby when nothing is highlighted", () => {
    expect(resolveBackAction("nearby", false, false, false)).toBe("exitApp");
  });

  it("goes back on another panel when the stack allows it", () => {
    expect(resolveBackAction("other", false, true, false)).toBe("goBack");
    expect(resolveBackAction("other", true, true, false)).toBe("goBack");
  });

  it("exits the app on another panel when the stack cannot go back", () => {
    expect(resolveBackAction("other", false, false, false)).toBe("exitApp");
    expect(resolveBackAction("other", true, false, false)).toBe("exitApp");
  });

  it("leaves the route picker first, whatever else is going on", () => {
    expect(resolveBackAction("other", false, true, true)).toBe("exitPickMode");
    expect(resolveBackAction("other", true, false, true)).toBe("exitPickMode");
    expect(resolveBackAction("nearby", true, false, true)).toBe("exitPickMode");
  });
});
