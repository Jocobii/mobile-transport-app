import { describe, expect, it } from "vitest";
import type {
  FeedConfig,
  Route,
  RouteId,
  RoutePattern,
  ScheduledStopTime,
  Stop,
  StopId,
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
  nearbyRadiusStepsMeters: [500, 1000, 1500],
  nearbyMinStops: 3,
  nearbyMinRadiusMeters: 50,
  nearbyMaxRadiusMeters: 2000,
  nearbyMaxStops: 10,
  nearbyFallbackMaxDistanceMeters: 5000,
  nearbyArrivalsPerStop: 3,
  areaStopsMaxSpanDegrees: 0.06,
  areaStopsMaxResults: 250,
  areaVehiclesMaxSpanDegrees: 0.3,
  areaVehiclesMaxResults: 150,
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
  /** A fixed list, or a function of the searched radius (for adaptive-radius tests). */
  stopsNear?: StopWithDistance[] | ((radiusMeters: number) => StopWithDistance[]);
  nearestStop?: StopWithDistance | undefined;
  stop?: Stop | undefined;
  routesServingStop?: Route[];
  route?: Route | undefined;
  patterns?: RoutePattern[];
  trip?: Trip | undefined;
  scheduledAtStop?: ScheduledStopTime[];
  scheduledForTrip?: ScheduledStopTime[];
  catalogVersion?: string | Promise<string>;
  /** Records every stop id arrivals were computed for, to check the adaptive radius does not
   * compute arrivals for steps it discards. */
  arrivalsCalls?: StopId[];
  stopsInBounds?: { stops: Stop[]; truncated: boolean };
  /** Records every routeId `getRoute` was called with, to check it is called once per distinct id. */
  getRouteCalls?: RouteId[];
}

function fakeCatalog(options: FakeCatalogOptions = {}): CatalogProvider {
  return {
    getCatalogVersion: async () => {
      if (options.catalogVersion === undefined) return "v1";
      return options.catalogVersion;
    },
    getStop: async () => options.stop,
    findStopsNear: async (_center, radiusMeters) =>
      typeof options.stopsNear === "function"
        ? options.stopsNear(radiusMeters)
        : (options.stopsNear ?? []),
    findNearestStop: async () => options.nearestStop,
    searchRoutes: async () => [],
    searchStops: async () => [],
    getRoute: async (routeId) => {
      options.getRouteCalls?.push(routeId);
      return options.route;
    },
    findStopsInBounds: async () => options.stopsInBounds ?? { stops: [], truncated: false },
    getRoutesServingStop: async () => options.routesServingStop ?? [],
    getRoutePatterns: async () => options.patterns ?? [],
    getTrip: async () => options.trip,
    getScheduledStopTimesAtStop: async (stopId) => {
      options.arrivalsCalls?.push(stopId);
      return options.scheduledAtStop ?? [];
    },
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

describe("getNearby adaptive radius (EPIC-005, no explicit radius)", () => {
  const STOPS_AT_500 = [
    { stop: { ...STOP, id: "s1" }, distanceMeters: 100 },
    { stop: { ...STOP, id: "s2" }, distanceMeters: 200 },
    { stop: { ...STOP, id: "s3" }, distanceMeters: 300 },
  ];
  const STOPS_AT_1000 = [
    ...STOPS_AT_500.slice(0, 2),
    { stop: { ...STOP, id: "s4" }, distanceMeters: 700 },
    { stop: { ...STOP, id: "s5" }, distanceMeters: 800 },
  ];
  const STOPS_AT_1500 = [{ stop: { ...STOP, id: "s1" }, distanceMeters: 100 }];

  it("stops at the first step (500 m) when it already finds >= nearbyMinStops", async () => {
    const calledRadii: number[] = [];
    const service = createTransitService({
      catalog: fakeCatalog({
        stopsNear: (radiusMeters) => {
          calledRadii.push(radiusMeters);
          return STOPS_AT_500;
        },
      }),
      realtime: [fakeRealtimeProvider(emptySnapshot())],
      clock: fakeClock(),
      settings: SETTINGS,
      feeds: FEEDS,
    });

    const result = await service.getNearby({ lat: STOP.lat, lon: STOP.lon });
    expect(result.outsideRadius).toBe(false);
    expect(result.stops.map((s) => s.stop.id)).toEqual(["s1", "s2", "s3"]);
    expect(calledRadii).toEqual([500]);
  });

  it("grows to 1000 m when 500 m finds fewer than nearbyMinStops", async () => {
    const calledRadii: number[] = [];
    const service = createTransitService({
      catalog: fakeCatalog({
        stopsNear: (radiusMeters) => {
          calledRadii.push(radiusMeters);
          if (radiusMeters === 500) return STOPS_AT_500.slice(0, 2);
          return STOPS_AT_1000;
        },
      }),
      realtime: [fakeRealtimeProvider(emptySnapshot())],
      clock: fakeClock(),
      settings: SETTINGS,
      feeds: FEEDS,
    });

    const result = await service.getNearby({ lat: STOP.lat, lon: STOP.lon });
    expect(result.outsideRadius).toBe(false);
    expect(result.stops.map((s) => s.stop.id)).toEqual(["s1", "s2", "s4", "s5"]);
    expect(calledRadii).toEqual([500, 1000]);
  });

  it("returns 1-2 stops from the last step (1500 m) without falling back", async () => {
    const service = createTransitService({
      catalog: fakeCatalog({
        stopsNear: (radiusMeters) => (radiusMeters === 1500 ? STOPS_AT_1500 : []),
      }),
      realtime: [fakeRealtimeProvider(emptySnapshot())],
      clock: fakeClock(),
      settings: SETTINGS,
      feeds: FEEDS,
    });

    const result = await service.getNearby({ lat: STOP.lat, lon: STOP.lon });
    expect(result.outsideRadius).toBe(false);
    expect(result.stops.map((s) => s.stop.id)).toEqual(["s1"]);
  });

  it("falls back to the nearest stop when every step finds none", async () => {
    const service = createTransitService({
      catalog: fakeCatalog({
        stopsNear: () => [],
        nearestStop: { stop: STOP, distanceMeters: 4000 },
      }),
      realtime: [fakeRealtimeProvider(emptySnapshot())],
      clock: fakeClock(),
      settings: SETTINGS,
      feeds: FEEDS,
    });

    const result = await service.getNearby({ lat: STOP.lat, lon: STOP.lon });
    expect(result.outsideRadius).toBe(true);
    expect(result.stops.map((s) => s.stop.id)).toEqual([STOP.id]);
  });

  it("does not adapt when an explicit radius is given, even if it finds few stops", async () => {
    const calledRadii: number[] = [];
    const service = createTransitService({
      catalog: fakeCatalog({
        stopsNear: (radiusMeters) => {
          calledRadii.push(radiusMeters);
          return radiusMeters === 500 ? STOPS_AT_500.slice(0, 1) : STOPS_AT_500;
        },
        nearestStop: { stop: STOP, distanceMeters: 4000 },
      }),
      realtime: [fakeRealtimeProvider(emptySnapshot())],
      clock: fakeClock(),
      settings: SETTINGS,
      feeds: FEEDS,
    });

    const result = await service.getNearby({ lat: STOP.lat, lon: STOP.lon }, 500);
    expect(calledRadii).toEqual([500]);
    expect(result.outsideRadius).toBe(false);
    expect(result.stops.map((s) => s.stop.id)).toEqual(["s1"]);
  });

  it("computes arrivals only for the final set of stops, not for discarded steps", async () => {
    const arrivalsCalls: StopId[] = [];
    const service = createTransitService({
      catalog: fakeCatalog({
        stopsNear: (radiusMeters) =>
          radiusMeters === 500 ? STOPS_AT_500.slice(0, 2) : STOPS_AT_1000,
        arrivalsCalls,
      }),
      realtime: [fakeRealtimeProvider(emptySnapshot())],
      clock: fakeClock(),
      settings: SETTINGS,
      feeds: FEEDS,
    });

    await service.getNearby({ lat: STOP.lat, lon: STOP.lon });
    expect(arrivalsCalls.sort()).toEqual(["s1", "s2", "s4", "s5"].sort());
  });
});

describe("getStopsInArea (EPIC-005)", () => {
  const BOUNDS = { minLat: 44.9, minLon: -93.3, maxLat: 45.0, maxLon: -93.2 };

  it("returns the stops and truncated flag the catalog reports", async () => {
    const service = createTransitService({
      catalog: fakeCatalog({
        stopsInBounds: { stops: [STOP], truncated: true },
      }),
      realtime: [fakeRealtimeProvider(emptySnapshot())],
      clock: fakeClock(),
      settings: SETTINGS,
      feeds: FEEDS,
    });

    const result = await service.getStopsInArea(BOUNDS);
    expect(result).toEqual({ stops: [STOP], truncated: true });
  });

  it("passes the configured max results as the limit", async () => {
    let capturedLimit: number | undefined;
    const catalog = fakeCatalog();
    const service = createTransitService({
      catalog: {
        ...catalog,
        findStopsInBounds: async (_bounds, limit) => {
          capturedLimit = limit;
          return { stops: [], truncated: false };
        },
      },
      realtime: [fakeRealtimeProvider(emptySnapshot())],
      clock: fakeClock(),
      settings: SETTINGS,
      feeds: FEEDS,
    });

    await service.getStopsInArea(BOUNDS);
    expect(capturedLimit).toBe(SETTINGS.areaStopsMaxResults);
  });
});

describe("getVehiclesInArea (EPIC-005)", () => {
  const BOUNDS = { minLat: 44.9, minLon: -93.3, maxLat: 45.0, maxLon: -93.2 };
  const CENTER_LAT = 44.95;
  const CENTER_LON = -93.25;

  function areaVehicle(id: string, lat: number, lon: number, routeId = ROUTE.id): Vehicle {
    return {
      id,
      feedId: "metrotransit",
      lat,
      lon,
      routeId,
      directionId: 0,
      tripId: `trip-${id}`,
      headsign: "Downtown",
      updatedAt: NOW,
    };
  }

  it("keeps only vehicles inside the bounds, sorted by distance to the center", async () => {
    const inside1 = areaVehicle("near", CENTER_LAT + 0.001, CENTER_LON);
    const inside2 = areaVehicle("far", CENTER_LAT + 0.03, CENTER_LON);
    const outside = areaVehicle("outside", 46, -93.25);
    const service = createTransitService({
      catalog: fakeCatalog({ route: ROUTE }),
      realtime: [
        fakeRealtimeProvider({
          ...emptySnapshot(),
          vehicles: [outside, inside2, inside1],
        }),
      ],
      clock: fakeClock(),
      settings: SETTINGS,
      feeds: FEEDS,
    });

    const result = await service.getVehiclesInArea(BOUNDS);
    expect(result.vehicles.map((v) => v.vehicle.id)).toEqual(["near", "far"]);
    expect(result.truncated).toBe(false);
  });

  it("caps at the configured max results and marks truncated", async () => {
    const settings: TransitSettings = { ...SETTINGS, areaVehiclesMaxResults: 1 };
    const vehicles = [
      areaVehicle("a", CENTER_LAT, CENTER_LON),
      areaVehicle("b", CENTER_LAT + 0.001, CENTER_LON),
    ];
    const service = createTransitService({
      catalog: fakeCatalog({ route: ROUTE }),
      realtime: [fakeRealtimeProvider({ ...emptySnapshot(), vehicles })],
      clock: fakeClock(),
      settings,
      feeds: FEEDS,
    });

    const result = await service.getVehiclesInArea(BOUNDS);
    expect(result.vehicles).toHaveLength(1);
    expect(result.truncated).toBe(true);
  });

  it("drops a vehicle whose route is not in the catalog", async () => {
    const service = createTransitService({
      catalog: fakeCatalog({ route: undefined }),
      realtime: [
        fakeRealtimeProvider({
          ...emptySnapshot(),
          vehicles: [areaVehicle("a", CENTER_LAT, CENTER_LON)],
        }),
      ],
      clock: fakeClock(),
      settings: SETTINGS,
      feeds: FEEDS,
    });

    const result = await service.getVehiclesInArea(BOUNDS);
    expect(result.vehicles).toEqual([]);
  });

  it("resolves each distinct route only once", async () => {
    const getRouteCalls: RouteId[] = [];
    const service = createTransitService({
      catalog: fakeCatalog({ route: ROUTE, getRouteCalls }),
      realtime: [
        fakeRealtimeProvider({
          ...emptySnapshot(),
          vehicles: [
            areaVehicle("a", CENTER_LAT, CENTER_LON, ROUTE.id),
            areaVehicle("b", CENTER_LAT + 0.001, CENTER_LON, ROUTE.id),
            areaVehicle("c", CENTER_LAT + 0.002, CENTER_LON, ROUTE.id),
          ],
        }),
      ],
      clock: fakeClock(),
      settings: SETTINGS,
      feeds: FEEDS,
    });

    await service.getVehiclesInArea(BOUNDS);
    expect(getRouteCalls).toEqual([ROUTE.id]);
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
