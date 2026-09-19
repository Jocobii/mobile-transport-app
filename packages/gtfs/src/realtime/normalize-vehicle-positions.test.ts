import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Trip } from "@transit/core";
import gtfsRealtimeBindings from "gtfs-realtime-bindings";
import { describe, expect, it } from "vitest";
import { normalizeVehiclePositions } from "./normalize-vehicle-positions";
import type { TripLookup } from "./trip-lookup";

const { FeedMessage } = gtfsRealtimeBindings.transit_realtime;

const FIXTURES_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "test/fixtures",
);

function loadFeedMessage(relativePath: string) {
  return FeedMessage.decode(readFileSync(path.join(FIXTURES_ROOT, relativePath)));
}

/** Every trip id is "known"; used to isolate normalization from catalog lookups. */
function fakeTripLookup(directionId: 0 | 1 = 0): TripLookup {
  return {
    async getTrip(tripId): Promise<Trip | undefined> {
      return {
        id: tripId,
        feedId: tripId.split(":")[0] as string,
        routeId: `${tripId.split(":")[0]}:fake-route`,
        directionId,
        headsign: "Fake headsign",
        patternId: "fake:0",
      };
    },
    async getScheduledStopTimesForTrip() {
      return [];
    },
  };
}

describe("normalizeVehiclePositions", () => {
  it("carries the catalog trip headsign on every vehicle", async () => {
    const message = loadFeedMessage("mvta/vehicle-positions.pb");

    const vehicles = await normalizeVehiclePositions(message, {
      feedId: "mvta",
      tripLookup: fakeTripLookup(),
    });

    expect(vehicles.length > 0).toBe(true);
    expect(vehicles.every((v) => v.headsign === "Fake headsign")).toBe(true);
  });

  it("resolves directionId from the catalog for MVTA vehicles (the feed has none)", async () => {
    const message = loadFeedMessage("mvta/vehicle-positions.pb");
    const directions: Record<string, 0 | 1> = {
      "mvta:t673-b13E-sl1C-v64": 0,
      "mvta:t65A-b174-sl1C-v64": 1,
      "mvta:t66D-b144-sl1C-v64": 1,
    };
    const tripLookup: TripLookup = {
      async getTrip(tripId) {
        return {
          id: tripId,
          feedId: "mvta",
          routeId: "mvta:436",
          directionId: directions[tripId] ?? 0,
          headsign: "Fake",
          patternId: "mvta:436:0",
        };
      },
      async getScheduledStopTimesForTrip() {
        return [];
      },
    };

    const vehicles = await normalizeVehiclePositions(message, { feedId: "mvta", tripLookup });
    expect(vehicles.length > 0).toBe(true);
    for (const vehicle of vehicles) {
      expect(vehicle.directionId).toBe(directions[vehicle.tripId]);
    }
  });

  it("drops entities without a usable position and removes duplicate ids", async () => {
    const message = loadFeedMessage("metrotransit/vehicle-positions.pb");
    const rawCount = message.entity.length;

    const vehicles = await normalizeVehiclePositions(message, {
      feedId: "metrotransit",
      tripLookup: fakeTripLookup(),
    });

    expect(vehicles.length < rawCount).toBe(true);
    expect(vehicles.every((v) => !(v.lat === 0 && v.lon === 0))).toBe(true);
    const ids = vehicles.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("skips an entity whose trip is not in the catalog", async () => {
    const message = {
      header: { gtfsRealtimeVersion: "2.0", timestamp: 1789597408 },
      entity: [
        {
          id: "e1",
          vehicle: {
            trip: { tripId: "unknown-trip" },
            position: { latitude: 44.9, longitude: -93.2 },
            vehicle: { id: "999" },
          },
        },
      ],
    };
    const tripLookup: TripLookup = {
      async getTrip() {
        return undefined;
      },
      async getScheduledStopTimesForTrip() {
        return [];
      },
    };
    const vehicles = await normalizeVehiclePositions(message, {
      feedId: "metrotransit",
      tripLookup,
    });
    expect(vehicles.length).toBe(0);
  });
});
