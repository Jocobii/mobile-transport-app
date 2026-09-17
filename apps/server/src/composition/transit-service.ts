import path from "node:path";
import {
  createGtfsRealtimeProvider,
  createSqliteCatalogProvider,
} from "@transit/gtfs";
import type { RealtimeProvider, TransitService } from "@transit/core";
import { createTransitService } from "@transit/core";
import { FEEDS } from "../config/feeds";
import { readServerConfig } from "../config/server-config";
import { TRANSIT_SETTINGS } from "../config/transit-settings";
import { createInMemoryCache } from "../infrastructure/in-memory-cache";
import { createSystemClock } from "../infrastructure/system-clock";

function resolveCatalogPath(): string {
  const configResult = readServerConfig();
  const configuredPath = configResult.ok ? configResult.config.catalogPath : undefined;
  return configuredPath ?? path.join(process.cwd(), "generated/catalog.sqlite");
}

function buildTransitService(): TransitService {
  const clock = createSystemClock();
  const catalog = createSqliteCatalogProvider({ databasePath: resolveCatalogPath() });
  const cache = createInMemoryCache(clock);

  const realtime: RealtimeProvider[] = FEEDS.map((feed) =>
    createGtfsRealtimeProvider({
      feed,
      catalog,
      cache,
      clock,
      settings: TRANSIT_SETTINGS,
    }),
  );

  return createTransitService({
    catalog,
    realtime,
    clock,
    settings: TRANSIT_SETTINGS,
    feeds: [...FEEDS],
  });
}

/**
 * The only allowed module-level state (section 11): the memoized TransitService for
 * the lifetime of this function instance. Building it opens the catalog database, so
 * a failed attempt (e.g. the catalog file is missing) is not cached - the next call
 * retries, which matters once a rebuilt catalog becomes available without a redeploy.
 */
let cachedService: TransitService | undefined;

export function getTransitService(): TransitService {
  if (!cachedService) {
    cachedService = buildTransitService();
  }
  return cachedService;
}
