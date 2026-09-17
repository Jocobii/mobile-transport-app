import { describe, expect, it } from "vitest";
import type { HealthResult } from "@transit/core";
import { mapHealthResult } from "./health";

describe("mapHealthResult", () => {
  it("maps every field, including an absent catalogVersion", () => {
    const result: HealthResult = {
      status: "degraded",
      checkedAt: 1000,
      feeds: [{ feedId: "metrotransit", ok: false }],
    };
    expect(mapHealthResult(result)).toEqual({
      status: "degraded",
      checkedAt: 1000,
      catalogVersion: undefined,
      feeds: [
        { feedId: "metrotransit", ok: false, dataTimestamp: undefined, fetchedAt: undefined },
      ],
    });
  });
});
