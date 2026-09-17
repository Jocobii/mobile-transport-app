/**
 * GTFS adapters (Node.js only).
 *
 * Planned modules:
 * - static/: parse GTFS zip files and build the catalog index (CatalogProvider).
 * - realtime/: decode GTFS-Realtime protobuf feeds and normalize them (RealtimeProvider).
 *
 * Normalization rules are generic GTFS/GTFS-RT rules. Never add logic for a specific route.
 */
export * from "./time/gtfs-time";
export * from "./static/gtfs-source";
export * from "./static/download-feed";
export * from "./static/simplify-shape";
export * from "./static/build-catalog";
