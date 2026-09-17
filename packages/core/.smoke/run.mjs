import { __run } from "./vitest-shim.mjs";

await import("../src/domain/approaching-vehicles.test.ts");
await import("../src/domain/direction.test.ts");
await import("../src/domain/freshness.test.ts");
await import("../src/domain/geo.test.ts");
await import("../src/domain/merge-arrivals.test.ts");
await import("../src/domain/natural-order.test.ts");
await import("../src/domain/search.test.ts");
await import("../src/transit-service.test.ts");

await __run();