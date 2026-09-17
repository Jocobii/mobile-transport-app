import gtfsRealtimeBindings from "gtfs-realtime-bindings";
import { describe, expect, it } from "vitest";
import type {
  Cache,
  CatalogProvider,
  Clock,
  FeedConfig,
  TransitSettings,
} from "@transit/core";
import { createGtfsRealtimeProvider } from "./gtfs-realtime-provider";
import type { TripLookup } from "./trip-lookup";

const { FeedMessage } = gtfsRealtimeBindings.transit_realtime;

function encodeMessage(timestamp: number): Uint8Array {
  const message = FeedMessage.create({
    header: { gtfsRealtimeVersion: "2.0", timestamp },
    entity: [],
  });
  return FeedMessage.encode(message).finish();
}

class FakeClock implements Clock {
  current = 1000;
  now() {
    return this.current;
  }
}

class FakeCache implements Cache {
  private readonly store = new Map<string, { value: unknown; expiresAt: number }>();
  private readonly clock: FakeClock;

  constructor(clock: FakeClock) {
    this.clock = clock;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (this.clock.now() >= entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value, expiresAt: this.clock.now() + ttlSeconds });
  }
}

const FAKE_CATALOG: TripLookup = {
  async getTrip() {
    return undefined;
  },
  async getScheduledStopTimesForTrip() {
    return [];
  },
};

const SETTINGS: TransitSettings = {
  realtimeCacheTtlSeconds: 20,
  realtimeStaleAfterSeconds: 120,
  feedFetchTimeoutMs: 50,
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
  httpUserAgent: "transit-app/0.1 (personal use)",
};

const FEED: FeedConfig = {
  id: "metrotransit",
  name: "Metro Transit",
  timezone: "America/Chicago",
  staticUrl: "",
  vehiclePositionsUrl: "https://example.com/vp.pb",
  tripUpdatesUrl: "https://example.com/tu.pb",
};

const CATALOG = FAKE_CATALOG as unknown as CatalogProvider;

describe("createGtfsRealtimeProvider", () => {
  it("serves a cache hit within the TTL without refetching", async () => {
    let fetchCount = 0;
    const clock = new FakeClock();
    const cache = new FakeCache(clock);
    const fetchImpl = (async () => {
      fetchCount++;
      return new Response(encodeMessage(clock.now()), { status: 200 });
    }) as unknown as typeof fetch;

    const provider = createGtfsRealtimeProvider({
      feed: FEED,
      catalog: CATALOG,
      cache,
      clock,
      settings: SETTINGS,
      fetchImpl,
    });

    await provider.getSnapshot();
    await provider.getSnapshot();
    expect(fetchCount).toBe(2); // one per URL, once
  });

  it("refetches after the cache TTL expires", async () => {
    let fetchCount = 0;
    const clock = new FakeClock();
    const cache = new FakeCache(clock);
    const fetchImpl = (async () => {
      fetchCount++;
      return new Response(encodeMessage(clock.now()), { status: 200 });
    }) as unknown as typeof fetch;

    const provider = createGtfsRealtimeProvider({
      feed: FEED,
      catalog: CATALOG,
      cache,
      clock,
      settings: SETTINGS,
      fetchImpl,
    });

    await provider.getSnapshot();
    clock.current += SETTINGS.realtimeCacheTtlSeconds + 1;
    await provider.getSnapshot();
    expect(fetchCount).toBe(4);
  });

  it("shares one in-flight fetch per URL across concurrent calls (single-flight)", async () => {
    let fetchCount = 0;
    const clock = new FakeClock();
    const cache = new FakeCache(clock);
    const fetchImpl = (async () => {
      fetchCount++;
      return new Promise<Response>((resolve) => {
        setTimeout(() => resolve(new Response(encodeMessage(clock.now()), { status: 200 })), 5);
      });
    }) as unknown as typeof fetch;

    const provider = createGtfsRealtimeProvider({
      feed: FEED,
      catalog: CATALOG,
      cache,
      clock,
      settings: SETTINGS,
      fetchImpl,
    });

    const [a, b] = await Promise.all([provider.getSnapshot(), provider.getSnapshot()]);
    expect(fetchCount).toBe(2);
    expect(a).toBe(b);
  });

  it("returns the successful part with ok: false on a partial failure", async () => {
    const clock = new FakeClock();
    const cache = new FakeCache(clock);
    const fetchImpl = (async (url: string) => {
      if (url.includes("vp")) return new Response(encodeMessage(clock.now()), { status: 200 });
      throw new Error("network down");
    }) as unknown as typeof fetch;

    const provider = createGtfsRealtimeProvider({
      feed: FEED,
      catalog: CATALOG,
      cache,
      clock,
      settings: SETTINGS,
      fetchImpl,
    });

    const snapshot = await provider.getSnapshot();
    expect(snapshot.status.ok).toBe(false);
    expect(snapshot.status.dataTimestamp).toBe(clock.now());
  });

  it("returns empty data with ok: false on total failure", async () => {
    const clock = new FakeClock();
    const cache = new FakeCache(clock);
    const fetchImpl = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    const provider = createGtfsRealtimeProvider({
      feed: FEED,
      catalog: CATALOG,
      cache,
      clock,
      settings: SETTINGS,
      fetchImpl,
    });

    const snapshot = await provider.getSnapshot();
    expect(snapshot.status.ok).toBe(false);
    expect(snapshot.vehicles.length).toBe(0);
    expect(snapshot.predictions.length).toBe(0);
  });

  it("honors the fetch timeout", async () => {
    const clock = new FakeClock();
    const cache = new FakeCache(clock);
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        setTimeout(() => _resolve(new Response(encodeMessage(clock.now()), { status: 200 })), 5000);
      });
    }) as unknown as typeof fetch;

    const provider = createGtfsRealtimeProvider({
      feed: FEED,
      catalog: CATALOG,
      cache,
      clock,
      settings: SETTINGS,
      fetchImpl,
    });

    const started = Date.now();
    const snapshot = await provider.getSnapshot();
    const elapsedMs = Date.now() - started;
    expect(snapshot.status.ok).toBe(false);
    expect(elapsedMs < 1000).toBe(true);
  });

  it("keeps serving the last good snapshot when it is not stale", async () => {
    const clock = new FakeClock();
    const cache = new FakeCache(clock);
    let shouldFail = false;
    const fetchImpl = (async () => {
      if (shouldFail) throw new Error("down");
      return new Response(encodeMessage(clock.now()), { status: 200 });
    }) as unknown as typeof fetch;

    const provider = createGtfsRealtimeProvider({
      feed: FEED,
      catalog: CATALOG,
      cache,
      clock,
      settings: SETTINGS,
      fetchImpl,
    });

    const good = await provider.getSnapshot();
    clock.current += SETTINGS.realtimeCacheTtlSeconds + 1;
    shouldFail = true;
    const fallback = await provider.getSnapshot();
    expect(fallback.status.dataTimestamp).toBe(good.status.dataTimestamp);
  });
});
