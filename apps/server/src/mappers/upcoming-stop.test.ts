import { describe, expect, it } from "vitest";
import type { Stop, UpcomingStopResult } from "@transit/core";
import { mapUpcomingStop } from "./upcoming-stop";

const STOP: Stop = {
  id: "56939",
  code: "56939",
  name: "MSP Terminal 1",
  lat: 44.88,
  lon: -93.2,
  feedIds: ["metrotransit"],
};

describe("mapUpcomingStop", () => {
  it("maps every DTO field", () => {
    const upcoming: UpcomingStopResult = {
      stop: STOP,
      stopSequence: 2,
      time: 1000,
      scheduledTime: 950,
      delaySec: 50,
      source: "live",
      status: "normal",
    };
    expect(mapUpcomingStop(upcoming)).toEqual({
      stop: { id: "56939", code: "56939", name: "MSP Terminal 1", lat: 44.88, lon: -93.2 },
      stopSequence: 2,
      time: 1000,
      scheduledTime: 950,
      delaySec: 50,
      source: "live",
      status: "normal",
    });
  });
});
