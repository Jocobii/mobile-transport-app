/**
 * GTFS adapters (Node.js only).
 *
 * Planned modules:
 * - static/: parse GTFS zip files and build the catalog index (CatalogProvider).
 * - realtime/: decode GTFS-Realtime protobuf feeds and normalize them (RealtimeProvider).
 *
 * Normalization rules are generic GTFS/GTFS-RT rules. Never add logic for a specific route.
 */

export * from "./catalog/sqlite-catalog-provider";
export * from "./realtime/gtfs-realtime-provider";
export * from "./realtime/normalize-trip-updates";
export * from "./realtime/normalize-vehicle-positions";
export * from "./realtime/trip-lookup";
export * from "./static/build-catalog";
export * from "./static/download-feed";
export * from "./static/gtfs-source";
export * from "./static/simplify-shape";
export * from "./time/gtfs-time";
