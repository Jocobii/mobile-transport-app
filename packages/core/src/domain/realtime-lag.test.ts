import { describe, expect, it } from "vitest";
import { summarizeRealtimeLag } from "./realtime-lag";

const BASE = {
  feedId: "f",
  fetchedAt: 1000,
  vehicleFeedTimestamp: 990,
  tripFeedTimestamp: 995,
};

describe("summarizeRealtimeLag", () => {
  it("reports feed header ages relative to the fetch time", () => {
    const sample = summarizeRealtimeLag({ ...BASE, vehicles: [] });
    expect(sample.vehicleFeedAgeSec).toBe(10);
    expect(sample.tripFeedAgeSec).toBe(5);
  });

  it("leaves feed ages undefined when a header timestamp is missing", () => {
    const sample = summarizeRealtimeLag({
      ...BASE,
      vehicleFeedTimestamp: undefined,
      tripFeedTimestamp: undefined,
      vehicles: [],
    });
    expect(sample.vehicleFeedAgeSec).toBeUndefined();
    expect(sample.tripFeedAgeSec).toBeUndefined();
  });

  it("has no position ages without vehicles", () => {
    const sample = summarizeRealtimeLag({ ...BASE, vehicles: [] });
    expect(sample.vehicleCount).toBe(0);
    expect(sample.positionAgeSec).toBeUndefined();
  });

  it("summarizes each vehicle's GPS report age with nearest-rank percentiles", () => {
    const ages = [5, 10, 15, 20, 25, 30, 35, 40, 45, 120];
    const vehicles = ages.map((age) => ({ updatedAt: 1000 - age }));
    const sample = summarizeRealtimeLag({ ...BASE, vehicles });
    expect(sample.vehicleCount).toBe(10);
    expect(sample.positionAgeSec).toEqual({ p50: 25, p90: 45, max: 120 });
  });

  it("never reports a negative age when a report is ahead of the server clock", () => {
    const sample = summarizeRealtimeLag({ ...BASE, vehicles: [{ updatedAt: 1010 }] });
    expect(sample.positionAgeSec).toEqual({ p50: 0, p90: 0, max: 0 });
  });
});
