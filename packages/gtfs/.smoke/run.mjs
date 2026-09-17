import { __run } from "./vitest-shim.mjs";

await import("../src/catalog/sqlite-catalog-provider.test.ts");
await import("../src/realtime/gtfs-realtime-provider.test.ts");
await import("../src/realtime/normalize-trip-updates.test.ts");
await import("../src/realtime/normalize-vehicle-positions.test.ts");
await import("../src/static/build-catalog.test.ts");
await import("../src/static/download-feed.test.ts");
await import("../src/static/gtfs-source.test.ts");
await import("../src/time/gtfs-time.test.ts");

await __run();