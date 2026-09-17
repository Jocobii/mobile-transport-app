import gtfsRealtimeBindings from "gtfs-realtime-bindings";
import type {
  Cache,
  CatalogProvider,
  Clock,
  EpochSeconds,
  FeedConfig,
  ProviderCapabilities,
  RealtimeProvider,
  RealtimeSnapshot,
  TransitSettings,
} from "@transit/core";
import { downloadStaticFeed } from "../static/download-feed";
import { normalizeTripUpdates } from "./normalize-trip-updates";
import { normalizeVehiclePositions } from "./normalize-vehicle-positions";

const { FeedMessage } = gtfsRealtimeBindings.transit_realtime;

export interface CreateGtfsRealtimeProviderOptions {
  feed: FeedConfig;
  catalog: CatalogProvider;
  cache: Cache;
  clock: Clock;
  settings: TransitSettings;
  fetchImpl?: typeof fetch;
}

const CAPABILITIES: ProviderCapabilities = {
  hasVehicles: true,
  hasPredictions: true,
  hasAlerts: false,
  idsMatchCatalog: true,
};

function parseHeaderTimestamp(value: unknown): EpochSeconds | undefined {
  if (value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function fetchAndDecode(
  url: string,
  options: { userAgent: string; timeoutMs: number; fetchImpl?: typeof fetch },
): Promise<InstanceType<typeof FeedMessage>> {
  const bytes = await downloadStaticFeed(url, options);
  return FeedMessage.decode(bytes);
}

function isStale(
  status: { dataTimestamp?: EpochSeconds },
  now: EpochSeconds,
  settings: TransitSettings,
): boolean {
  if (status.dataTimestamp === undefined) return true;
  return now - status.dataTimestamp > settings.realtimeStaleAfterSeconds;
}

/**
 * `RealtimeProvider` for one GTFS feed: fetches VehiclePosition and TripUpdate in
 * parallel, normalizes them (10.7), and caches the result (10.8). Never throws.
 */
export function createGtfsRealtimeProvider(
  options: CreateGtfsRealtimeProviderOptions,
): RealtimeProvider {
  const { feed, catalog, cache, clock, settings, fetchImpl } = options;
  const cacheKey = `realtime:${feed.id}`;

  let lastGoodSnapshot: RealtimeSnapshot | undefined;
  let inFlight: Promise<RealtimeSnapshot> | undefined;

  type FetchOneResult = {
    message: InstanceType<typeof FeedMessage>;
    headerTimestamp: EpochSeconds | undefined;
  };
  async function fetchOne(url: string): Promise<FetchOneResult | undefined> {
    try {
      const message = await fetchAndDecode(url, {
        userAgent: settings.httpUserAgent,
        timeoutMs: settings.feedFetchTimeoutMs,
        fetchImpl,
      });
      return { message, headerTimestamp: parseHeaderTimestamp(message.header?.timestamp) };
    } catch {
      return undefined;
    }
  }

  async function buildSnapshot(): Promise<RealtimeSnapshot> {
    const [vehicleResult, tripResult] = await Promise.all([
      fetchOne(feed.vehiclePositionsUrl),
      fetchOne(feed.tripUpdatesUrl),
    ]);

    const now = clock.now();

    if (!vehicleResult && !tripResult) {
      if (lastGoodSnapshot && !isStale(lastGoodSnapshot.status, now, settings)) {
        return lastGoodSnapshot;
      }
      return {
        feedId: feed.id,
        vehicles: [],
        predictions: [],
        status: { feedId: feed.id, ok: false, fetchedAt: now },
      };
    }

    const vehicles = vehicleResult
      ? await normalizeVehiclePositions(vehicleResult.message, {
          feedId: feed.id,
          tripLookup: catalog,
        })
      : [];
    const predictions = tripResult
      ? await normalizeTripUpdates(tripResult.message, {
          feedId: feed.id,
          timezone: feed.timezone,
          tripLookup: catalog,
        })
      : [];

    const timestamps = [vehicleResult?.headerTimestamp, tripResult?.headerTimestamp].filter(
      (t): t is EpochSeconds => t !== undefined,
    );
    const dataTimestamp = timestamps.length > 0 ? Math.min(...timestamps) : undefined;

    const snapshot: RealtimeSnapshot = {
      feedId: feed.id,
      vehicles,
      predictions,
      status: {
        feedId: feed.id,
        ok: vehicleResult !== undefined && tripResult !== undefined,
        dataTimestamp,
        fetchedAt: now,
      },
    };

    if (snapshot.status.ok) lastGoodSnapshot = snapshot;
    return snapshot;
  }

  async function getSnapshot(): Promise<RealtimeSnapshot> {
    const cached = await cache.get<RealtimeSnapshot>(cacheKey);
    if (cached) return cached;

    if (inFlight) return inFlight;

    inFlight = (async () => {
      try {
        const snapshot = await buildSnapshot();
        await cache.set(cacheKey, snapshot, settings.realtimeCacheTtlSeconds);
        return snapshot;
      } finally {
        inFlight = undefined;
      }
    })();

    return inFlight;
  }

  return {
    feedId: feed.id,
    capabilities: CAPABILITIES,
    getSnapshot,
  };
}
