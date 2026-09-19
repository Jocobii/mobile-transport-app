import type { TransitService } from "@transit/core";
import type { ServerConfigResult } from "@/config/server-config";

export const OK_CONFIG: ServerConfigResult = { ok: true, config: { apiKey: "secret" } };

function notImplemented(name: string) {
  return async () => {
    throw new Error(`fakeTransitService: ${name} was not expected to be called in this test`);
  };
}

/** A TransitService fake where every method throws unless overridden. */
export function fakeTransitService(overrides: Partial<TransitService>): TransitService {
  return {
    getNearby: notImplemented("getNearby"),
    getStopsInArea: notImplemented("getStopsInArea"),
    getVehiclesInArea: notImplemented("getVehiclesInArea"),
    search: notImplemented("search"),
    getStopArrivals: notImplemented("getStopArrivals"),
    getStopTimetable: notImplemented("getStopTimetable"),
    getRouteDetail: notImplemented("getRouteDetail"),
    getRouteVehicles: notImplemented("getRouteVehicles"),
    getVehicleDetail: notImplemented("getVehicleDetail"),
    getHealth: notImplemented("getHealth"),
    ...overrides,
  } as TransitService;
}

export function authedRequest(url: string): Request {
  return new Request(url, { headers: { "x-api-key": "secret" } });
}

export function unauthedRequest(url: string): Request {
  return new Request(url);
}
