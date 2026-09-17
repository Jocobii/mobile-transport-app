import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import gtfsRealtimeBindings from "gtfs-realtime-bindings";
import { describe, expect, it } from "vitest";
import type { ScheduledStopTime, Trip } from "@transit/core";
import { normalizeTripUpdates } from "./normalize-trip-updates";
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

const FAKE_TRIP: Trip = {
  id: "metrotransit:1131632",
  feedId: "metrotransit",
  routeId: "metrotransit:54",
  directionId: 0,
  headsign: "Fake headsign",
  patternId: "metrotransit:54:0",
};

const FAKE_SCHEDULE: ScheduledStopTime[] = [
  {
    tripId: FAKE_TRIP.id,
    routeId: FAKE_TRIP.routeId,
    directionId: FAKE_TRIP.directionId,
    headsign: FAKE_TRIP.headsign,
    stopId: "56875",
    stopSequence: 1,
    serviceDate: "20260916",
    time: 1789599000,
  },
  {
    tripId: FAKE_TRIP.id,
    routeId: FAKE_TRIP.routeId,
    directionId: FAKE_TRIP.directionId,
    headsign: FAKE_TRIP.headsign,
    stopId: "41259",
    stopSequence: 2,
    serviceDate: "20260916",
    time: 1789599200,
  },
];

function fakeTripLookup(knownTripIds: string[] = [FAKE_TRIP.id]): TripLookup {
  return {
    async getTrip(tripId) {
      return knownTripIds.includes(tripId) ? { ...FAKE_TRIP, id: tripId } : undefined;
    },
    async getScheduledStopTimesForTrip(tripId) {
      return knownTripIds.includes(tripId) ? FAKE_SCHEDULE.map((s) => ({ ...s, tripId })) : [];
    },
  };
}

describe("normalizeTripUpdates", () => {
  it("maps a SKIPPED stop time update to status: skipped", async () => {
    const message = {
      header: { gtfsRealtimeVersion: "2.0", timestamp: 1789597408 },
      entity: [
        {
          id: "e1",
          tripUpdate: {
            trip: { tripId: "1131632", startDate: "20260916" },
            stopTimeUpdate: [{ stopSequence: 1, stopId: "56875", scheduleRelationship: 1 }],
          },
        },
      ],
    };
    const predictions = await normalizeTripUpdates(message, {
      feedId: "metrotransit",
      timezone: "America/Chicago",
      tripLookup: fakeTripLookup(),
    });
    expect(predictions.length).toBe(1);
    expect(predictions[0]?.status).toBe("skipped");
    expect(predictions[0]?.time).toBe(0);
  });

  it("maps a CANCELED trip to one canceled prediction per scheduled stop", async () => {
    const message = {
      header: { gtfsRealtimeVersion: "2.0", timestamp: 1789597408 },
      entity: [
        {
          id: "e1",
          tripUpdate: {
            trip: { tripId: "1131632", startDate: "20260916", scheduleRelationship: 3 },
            stopTimeUpdate: [],
          },
        },
      ],
    };
    const predictions = await normalizeTripUpdates(message, {
      feedId: "metrotransit",
      timezone: "America/Chicago",
      tripLookup: fakeTripLookup(),
    });
    expect(predictions.length).toBe(FAKE_SCHEDULE.length);
    expect(predictions.every((p) => p.status === "canceled" && p.time === 0)).toBe(true);
  });

  it("skips a NO_DATA stop time update", async () => {
    const message = {
      header: { gtfsRealtimeVersion: "2.0", timestamp: 1789597408 },
      entity: [
        {
          id: "e1",
          tripUpdate: {
            trip: { tripId: "1131632", startDate: "20260916" },
            stopTimeUpdate: [{ stopSequence: 1, stopId: "56875", scheduleRelationship: 2 }],
          },
        },
      ],
    };
    const predictions = await normalizeTripUpdates(message, {
      feedId: "metrotransit",
      timezone: "America/Chicago",
      tripLookup: fakeTripLookup(),
    });
    expect(predictions.length).toBe(0);
  });

  it("drops a stop time update whose time is in the past", async () => {
    const message = {
      header: { gtfsRealtimeVersion: "2.0", timestamp: 1789597408 },
      entity: [
        {
          id: "e1",
          tripUpdate: {
            trip: { tripId: "1131632", startDate: "20260916" },
            stopTimeUpdate: [
              { stopSequence: 1, stopId: "56875", arrival: { time: 1789597408 - 100 } },
            ],
          },
        },
      ],
    };
    const predictions = await normalizeTripUpdates(message, {
      feedId: "metrotransit",
      timezone: "America/Chicago",
      tripLookup: fakeTripLookup(),
    });
    expect(predictions.length).toBe(0);
  });

  it("uses departure.time when arrival is absent", async () => {
    const message = {
      header: { gtfsRealtimeVersion: "2.0", timestamp: 1789597408 },
      entity: [
        {
          id: "e1",
          tripUpdate: {
            trip: { tripId: "1131632", startDate: "20260916" },
            stopTimeUpdate: [
              { stopSequence: 1, stopId: "56875", departure: { time: 1789599165, delay: 225 } },
            ],
          },
        },
      ],
    };
    const predictions = await normalizeTripUpdates(message, {
      feedId: "metrotransit",
      timezone: "America/Chicago",
      tripLookup: fakeTripLookup(),
    });
    expect(predictions.length).toBe(1);
    expect(predictions[0]?.time).toBe(1789599165);
    expect(predictions[0]?.delaySec).toBe(225);
    expect(predictions[0]?.status).toBe("normal");
  });

  it("skips entities whose trip is not in the catalog", async () => {
    const message = loadFeedMessage("metrotransit/trip-updates.pb");
    const predictions = await normalizeTripUpdates(message, {
      feedId: "metrotransit",
      timezone: "America/Chicago",
      tripLookup: fakeTripLookup([]),
    });
    expect(predictions.length).toBe(0);
  });
});
