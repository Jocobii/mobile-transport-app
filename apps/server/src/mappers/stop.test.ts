import type { Stop } from "@transit/core";
import { describe, expect, it } from "vitest";
import { mapStop } from "./stop";

describe("mapStop", () => {
  it("maps every DTO field", () => {
    const stop: Stop = {
      id: "56939",
      code: "56939",
      name: "MSP Terminal 1 Transit Station",
      lat: 44.880248,
      lon: -93.204865,
      feedIds: ["metrotransit", "mvta"],
    };
    expect(mapStop(stop)).toEqual({
      id: "56939",
      code: "56939",
      name: "MSP Terminal 1 Transit Station",
      lat: 44.880248,
      lon: -93.204865,
    });
  });
});
