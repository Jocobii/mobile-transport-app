import { describe, expect, it } from "vitest";
import { mapFeedStatus } from "./feed-status";

describe("mapFeedStatus", () => {
  it("maps every DTO field", () => {
    expect(
      mapFeedStatus({ feedId: "metrotransit", ok: true, dataTimestamp: 100, fetchedAt: 105 }),
    ).toEqual({ feedId: "metrotransit", ok: true, dataTimestamp: 100, fetchedAt: 105 });
  });

  it("omits dataTimestamp and fetchedAt when absent", () => {
    expect(mapFeedStatus({ feedId: "mvta", ok: false })).toEqual({
      feedId: "mvta",
      ok: false,
      dataTimestamp: undefined,
      fetchedAt: undefined,
    });
  });
});
