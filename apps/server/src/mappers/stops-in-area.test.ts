import type { Stop, StopsInAreaResult } from "@transit/core";
import { describe, expect, it } from "vitest";
import { mapStopsInAreaResult } from "./stops-in-area";

describe("mapStopsInAreaResult", () => {
  it("maps stops and the truncated flag", () => {
    const stop: Stop = {
      id: "56939",
      code: "56939",
      name: "MSP Terminal 1",
      lat: 44.880248,
      lon: -93.204865,
      feedIds: ["metrotransit"],
    };
    const result: StopsInAreaResult = { stops: [stop], truncated: true };

    const response = mapStopsInAreaResult(result);
    expect(response).toEqual({
      stops: [
        { id: "56939", code: "56939", name: "MSP Terminal 1", lat: 44.880248, lon: -93.204865 },
      ],
      truncated: true,
    });
  });
});
