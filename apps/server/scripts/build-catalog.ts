/**
 * Builds `generated/catalog.sqlite` from the configured feeds (EPIC-001 §13, E001-T16).
 *
 * Run with `tsx` from `apps/server`:
 *   pnpm run catalog:build         # downloads the static feeds
 *   pnpm run catalog:build:raw     # builds from data/raw/ instead (no network)
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  type BuildCatalogFeedInput,
  buildCatalog,
  createDirectoryGtfsSource,
  createZipGtfsSource,
  downloadStaticFeed,
} from "@transit/gtfs";
import { FEEDS } from "@/config/feeds";
import { TRANSIT_SETTINGS } from "@/config/transit-settings";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(SCRIPT_DIR, "..");
const REPO_ROOT = path.resolve(SERVER_DIR, "..", "..");
const RAW_DIR = path.join(REPO_ROOT, "data", "raw");
const OUTPUT_PATH = path.join(SERVER_DIR, "generated", "catalog.sqlite");

const useRaw = process.argv.includes("--source=raw");

async function buildFeedInput(feed: (typeof FEEDS)[number]): Promise<BuildCatalogFeedInput> {
  if (!useRaw) {
    const bytes = await downloadStaticFeed(feed.staticUrl, {
      userAgent: TRANSIT_SETTINGS.httpUserAgent,
      timeoutMs: TRANSIT_SETTINGS.feedFetchTimeoutMs,
    });
    return { config: feed, source: createZipGtfsSource(bytes) };
  }

  // Raw fixtures (data/raw/, git-ignored): Metro Transit is already unzipped, MVTA is a zip.
  if (feed.id === "metrotransit") {
    return {
      config: feed,
      source: createDirectoryGtfsSource(path.join(RAW_DIR, "metrotransit", "gtfs")),
    };
  }
  if (feed.id === "mvta") {
    const bytes = readFileSync(path.join(RAW_DIR, "mvta", "gtfs.zip"));
    return { config: feed, source: createZipGtfsSource(new Uint8Array(bytes)) };
  }
  throw new Error(`No raw fixture wired up for feed "${feed.id}". Add one in scripts/build-catalog.ts.`);
}

async function main(): Promise<void> {
  console.log(`Building catalog from ${useRaw ? "data/raw/ (--source=raw)" : "live downloads"}...`);

  const feeds = await Promise.all(FEEDS.map(buildFeedInput));

  const started = Date.now();
  const result = await buildCatalog({
    feeds,
    outputPath: OUTPUT_PATH,
    now: Math.floor(Date.now() / 1000),
    settings: TRANSIT_SETTINGS,
  });
  const totalDurationMs = Date.now() - started;

  for (const feedSummary of result.feeds) {
    const counts = Object.entries(feedSummary.counts)
      .map(([table, count]) => `${table}=${count}`)
      .join(", ");
    console.log(`  ${feedSummary.feedId}: ${counts} (${feedSummary.durationMs}ms)`);
  }
  console.log(`catalogVersion=${result.catalogVersion}`);
  console.log(`Wrote ${result.outputPath} in ${totalDurationMs}ms`);
}

main().catch((err) => {
  console.error("Catalog build failed:", err);
  process.exitCode = 1;
});
