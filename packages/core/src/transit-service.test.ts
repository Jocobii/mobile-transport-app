import { describe, expect, it } from "vitest";
import type {
  FeedConfig,
  Route,
  RoutePattern,
  ScheduledStopTime,
  Stop,
  StopTimePrediction,
  StopWithDistance,
  Trip,
  Vehicle,
} from "./model";
import type { CatalogProvider, Clock, RealtimeProvider, RealtimeSnapshot } from "./ports";
import type { TransitSettings } from "./settings";
import { createTransitService } from "./transit-service";

const SETTINGS: TransitSettings = {
  realtimeCacheTtlSeconds: 20,
  realtimeStaleAfterSeconds: 120,
  feedFetchTimeoutMs: 8000,
  nearbyDefaultRadiusMeters: 500,
  nearbyMinRadiusMeters: 50,
  nearbyMaxRadiusMeters: 2000,
  nearbyMaxStops: 10,
  nearbyFallbackMaxDistanceMeters: 5000,
  nearbyArrivalsPerStop: 3,
  arrivalsWindowMinutes: 90,
  stopArrivalsLimit: 30,
  pastArrivalGraceSeconds: 60,
  searchMaxRoutes: 10,
  searchMaxStops: 20,
  searchMaxQueryLength: 50,
  catalogServiceDaysBefore: 1,
  catalogServiceDaysAfter: 13,
  patternLookaheadDays: 7,
  shapeSimplifyToleranceMeters: 5,
  httpUserAgent: "transit-app-tests",
};

const FEEDS: FeedConfig[] = [
  {
    id: "metrotransit",
    name: "Metro Transit",
    timezone: "America/Chicago",
    staticUrl: "https://example.test/gtfs.zip",
    vehiclePositionsUrl: "https://example.test/vp.pb",
    tripUpdatesUrl: "https://example.test/tu.pb",
  },
];

const NOW = 1_789_600_000;

function fakeClock(now: number = NOW): Clock {
  return { now: () => now };
}

const STOP: Stop = {
  id: "56939",
  code: "56939",
  name: "MSP Terminal 1",
  lat: 44.880248,
  lon: -93.204865,
  feedIds: ["metrotransit"],
};

const ROUTE: Route = {
  id: "metrotransit:54",
  feedId: "metrotransit",
  agencyId: "metrotransit",
  shortName: "54",
  longName: "MSP - St Paul",
};

const TRIP: Trip = {
  id: "metrotransit:t1",
  feedId: "metrotransit",
  routeId: "metrotransit:54",
  directionId: 0,
  headsign: "Downtown",
  patternId: "metrotransit:54:0",
};

interface FakeCatalogOptions {
  stopsNear?: StopWithDistance[];
  nearestStop?: StopWithDistance | undefined;
  stop?: Stop | undefined;
  routesServingStop?: Route[];
  route?: Route | undefined;
  patterns?: RoutePattern[];
  trip?: Trip | undefined;
  scheduledAtStop?: ScheduledStopTime[];
  scheduledForTrip?: ScheduledStopTime[];
  catalogVersion?: string | Promise<string>;
}

function fakeCatalog(options: FakeCatalogOptions = {}): CatalogProvider {
  return {
    getCatalogVersion: async () => {
      if (options.catalogVersion === undefined) return "v1";
      return options.catalogVersion;
    },
    getStop: async () => options.stop,
    findStopsNear: async () => options.stopsNear ?? [],
    findNearestStop: async () => options.nearestStop,
    searchRoutes: async () => [],
    searchStops: async () => [],
    getRoute: async () => options.route,
    getRoutesServingStop: async () => options.routesServingStop ?? [],
    getRoutePatterns: async () => options.patterns ?? [],
    getTrip: async () => options.trip,
    getScheduledStopTimesAtStop: async () => options.scheduledAtStop ?? [],
    getScheduledStopTimesForTrip: async () => options.scheduledForTrip ?? [],
  };
}

function fakeRealtimeProvider(snapshot: RealtimeSnapshot): RealtimeProvider {
  return {
    feedId: snapshot.feedId,
    capabilities: {
      hasVehicles: true,
      hasPredictions: true,
      hasAlerts: false,
      idsMatchCatalog: true,
    },
    getSnapshot: async () => snapshot,
  };
}

function emptySnapshot(feedId = "metrotransit", ok = true): RealtimeSnapshot {
  return {
    feedId,
    vehicles: [],
    predictions: [],
    status: { feedId, ok, dataTimestamp: NOW, fetchedAt: NOW },
  };
}

describe("getNearby (10.11)", () => {
  it("returns stops inside the radius with routes and arrivals", async () => {
    const scheduled: ScheduledStopTime[] = [
      {
        tripId: TRIP.id,
        routeId: ROUTE.id,
        directionId: 0,
        headsign: "Downtown",
        stopId: STOP.id,
        stopSequence: 1,
        serviceDate: "20260916",
        time: NOW + 100,
      },
    ];
    const service = createTransitService({
      catalog: fakeCatalog({
        stopsNear: [{ stop: STOP, distanceMeters: 42 }],
        routesServingStop: [ROUTE],
        scheduledAtStop: scheduled,
      }),
      realtime: [fakeRealtimeProvider(emptySnapshot())],
      clock: fakeClock(),
      settings: SETTINGS,
      feeds: FEEDS,
    });

    const result = await service.getNearby({ lat: STOP.lat, lon: STOP.lon }, 500);
    expect(result.outsideRadius).toBe(false);
    expect(result.stops).toHaveLength(1);
    expect(result.stops[0]?.stop.id).toBe(STOP.id);
    expect(result.stops[0]?.routes).toEqual([ROUTE]);
    expect(result.stops[0]?.nextArrivals).toHaveLength(1);
  });

  it("falls back to the nearest stop with outsideRadius: true when none is in radius", async () => {
    const service = createTransitService({
      catalog: fakeCatalog({ stopsNear: [], nearestStop: { stop: STOP, distanceMeters: 3000 } }),
      realtime: [fakeRealtimeProvider(emptySnapshot())],
      clock: fakeClock(),
      settings: SETTINGS,
      feeds: FEEDS,
    });

    const result = await service.getNearby({ lat: STOP.lat, lon: STOP.lon }, 500);
    expect(result.outsideRadius).toBe(true);
    expect(result.stops.map((s) => s.stop.id)).toEqual([STOP.id]);
  });

  it("returns no stops with outsideRadius: false outside the fallback range", async () => {
    const service = createTransitService({
      catalog: fakeCatalog({ stopsNear: [], nearestStop: undefined }),
      realtime: [fakeRealtimeProvider(emptySnapshot())],
      clock: fakeClock(),
      settings: SETTINGS,
      feeds: FEEDS,
    });

    const result = await service.getNearby({ lat: STOP.lat, lon: STOP.lon }, 500);
    expect(result.outsideRadius).toBe(false);
    expect(result.stops).toEqual([]);
  });
});

describe("getStopArrivals (10.9)", () => {
  it("mixes live and scheduled arrivals for the stop", async () => {
    const scheduled: ScheduledStopTime[] = [
      {
        tripId: "metrotransit:t1",
        routeId: ROUTE.id,
        directionId: 0,
        headsign: "Downtown",
        stopId: STOP.id,
        stopSequence: 1,
        serviceDate: "20260916",
        time: NOW + 100,
      },
      {
        tripId: "metrotransit:t2",
        routeId: ROUTE.id,
        directionId: 0,
        headsign: "Downtown",
        stopId: STOP.id,
        stopSequence: 1,
        serviceDate: "20260916",
        time: NOW + 200,
      },
    ];
    const predictions: StopTimePrediction[] = [
      {
        feedId: "metrotransit",
        tripId: "metrotransit:t1",
        serviceDate: "20260916",
        routeId: ROUTE.id,
        directionId: 0,
        stopId: STOP.id,
        time: NOW + 130,
        status: "normal",
      },
    ];
    const service = createTransitService({
      catalog: fakeCatalog({ stop: STOP, routesServingStop: [ROUTE], scheduledAtStop: scheduled }),
      realtime: [
        fakeRealtimeProvider({
          feedId: "metrotransit",
          vehicles: [],
          predictions,
          status: { feedId: "metrotransit", ok: true, dataTimestamp: NOW, fetchedAt: NOW },
        }),
      ],
      clock: fakeClock(),
      settings: SETTINGS,
      feeds: FEEDS,
    });

    const result = await service.getStopArrivals(STOP.id);
    expect(result?.arrivals.map((a) => a.source)).toEqual(["live", "scheduled"]);
  });

  it("returns undefined for a stop that isn't in the catalog", async () => {
    const service = createTransitService({
      catalog: fakeCatalog({ stop: undefined }),
      realtime: [fakeRealtimeProvider(emptySnapshot())],
      clock: fakeClock(),
      settings: SETTINGS,
      feeds: FEEDS,
    });

    expect(await service.getStopArrivals("unknown")).toBeUndefined();
  });
});

describe("getRouteDetail (10.12)", () => {
  const patternA: RoutePattern = {
    id: "metrotransit:54:0",
    routeId: ROUTE.id,
    directionId: 0,
    headsign: "Downtown",
    stops: [{ ...STOP, id: "near-a", lat: 44.9, lon: -93.2 }],
    shape: [],
  };
  const patternB: RoutePattern = {
    id: "metrotransit:54:1",
    routeId: ROUTE.id,
    directionId: 1,
    headsign: "Suburbs",
    stops: [{ ...STOP, id: "near-b", lat: 44.88, lon: -93.204 }],
    shape: [],
  };

  it("selects the direction whose pattern is closest to `near`", async () => {
    const service = createTransitService({
      catalog: fakeCatalog({ route: ROUTE, patterns: [patternA, patternB] }),
      realtime: [],
      clock: fakeClock(),
      settings: SETTINGS,
      feeds: FEEDS,
    });

    const near = { lat: 44.880248, lon: -93.204865 };
    const result = await service.getRouteDetail(ROUTE.id, { near });
    expect(result?.selectedDirectionId).toBe(1);
    expect(result?.directions).toEqual([
      { directionId: 0, headsign: "Downtown" },
      { directionId: 1, headsign: "Suburbs" },
    ]);
  });

  it("returns undefined for a route with no patterns", async () => {
    const service = createTransitService({
      catalog: fakeCatalog({ route: ROUTE, patterns: [] }),
      realtime: [],
      clock: fakeClock(),
      settings: SETTINGS,
      feeds: FEEDS,
    });

    expect(await service.getRouteDetail(ROUTE.id, {})).toBeUndefined();
  });
});

describe("getVehicleDetail (10.14)", () => {
  it("returns upcoming stops sorted by stop sequence, merged with predictions", async () => {
    const vehicle: Vehicle = {
      id: "metrotransit:v1",
      feedId: "metrotransit",
      lat: 44.88,
      lon: -93.2,
      routeId: ROUTE.id,
      directionId: 0,
      tripId: TRIP.id,
      headsign: TRIP.headsign,
      currentStopSequence: 1,
      updatedAt: NOW,
    };
    const scheduledForTrip: ScheduledStopTime[] = [
      {
        tripId: TRIP.id,
        routeId: ROUTE.id,
        directionId: 0,
        headsign: "Downtown",
        stopId: "s2",
        stopSequence: 2,
        serviceDate: "20260916",
        time: NOW + 300,
      },
      {
        tripId: TRIP.id,
        routeId: ROUTE.id,
        directionId: 0,
        headsign: "Downtown",
        stopId: STOP.id,
        stopSequence: 1,
        serviceDate: "20260916",
        time: NOW + 100,
      },
    ];
    const predictions: StopTimePrediction[] = [
      {
        feedId: "metrotransit",
        tripId: TRIP.id,
        serviceDate: "20260916",
        routeId: ROUTE.id,
        directionId: 0,
        stopId: STOP.id,
        time: NOW + 130,
        status: "normal",
      },
    ];
    const service = createTransitService({
      catalog: fakeCatalog({
        route: ROUTE,
        trip: TRIP,
        stop: STOP,
        scheduledForTrip,
      }),
      realtime: [
        fakeRealtimeProvider({
          feedId: "metrotransit",
          vehicles: [vehicle],
          predictions,
          status: { feedId: "metrotransit", ok: true, dataTimestamp: NOW, fetchedAt: NOW },
        }),
      ],
      clock: fakeClock(),
      settings: SETTINGS,
      feeds: FEEDS,
    });

    const result = await service.getVehicleDetail(vehicle.id);
    expect(result?.upcomingStops.map((s) => s.stopSequence)).toEqual([1, 2]);
    expect(result?.upcomingStops[0]?.source).toBe("live");
    expect(result?.upcomingStops[0]?.time).toBe(NOW + 130);
  });

  it("returns undefined when the vehicle isn't in any fresh snapshot", async () => {
    const service = createTransitService({
      catalog: fakeCatalog({}),
      realtime: [fakeRealtimeProvider(emptySnapshot())],
      clock: fakeClock(),
      settings: SETTINGS,
      feeds: FEEDS,
    });

    expect(await service.getVehicleDetail("unknown")).toBeUndefined();
  });
});

describe("getHealth (10.15)", () => {
  it("is degraded when one feed status is not ok", async () => {
    const service = createTransitService({
      catalog: fakeCatalog({ catalogVersion: "2026-09-16|metrotransit=1" }),
      realtime: [
        fakeRealtimeProvider(emptySnapshot("metrotransit", true)),
        fakeRealtimeProvider(emptySnapshot("mvta", false)),
      ],
      clock: fakeClock(),
      settings: SETTINGS,
      feeds: FEEDS,
    });

    const result = await service.getHealth();
    expect(result.status).toBe("degraded");
    expect(result.catalogVersion).toBe("2026-09-16|metrotransit=1");
  });

  it("is ok when the catalog is readable and every feed is ok", async () => {
    const service = createTransitService({
      catalog: fakeCatalog({ catalogVersion: "v1" }),
      realtime: [fakeRealtimeProvider(emptySnapshot("metrotransit", true))],
      clock: fakeClock(),
      settings: SETTINGS,
      feeds: FEEDS,
    });

    expect((await service.getHealth()).status).toBe("ok");
  });
});
