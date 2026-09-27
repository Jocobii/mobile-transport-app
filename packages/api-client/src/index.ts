import {
  API_KEY_HEADER,
  API_VERSION,
  type ApiErrorBody,
  type ApiErrorCode,
  type HealthResponse,
  INSTALL_ID_HEADER,
  type NearbyStopsResponse,
  type RouteDetailResponse,
  type RouteVehiclesResponse,
  type SearchResponse,
  type StopArrivalsResponse,
  type StopsInAreaResponse,
  type StopTimetableResponse,
  USER_NAME_HEADER,
  type VehicleDetailResponse,
  type VehiclesInAreaResponse,
} from "@transit/contracts";

export interface ClientIdentity {
  userName: string;
  installId: string;
}

export interface ApiClientOptions {
  baseUrl: string;
  apiKey?: string;
  /** Read on every request so a name saved after startup is picked up. */
  getIdentity?: () => ClientIdentity | undefined;
  fetchImpl?: typeof fetch;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode | "http_error",
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Builds a `?a=1&b=2` query string, omitting undefined values. */
function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const query = search.toString();
  return query === "" ? "" : `?${query}`;
}

export interface AreaBounds {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}

/** `minLon,minLat,maxLon,maxLat` (GeoJSON order), 6 decimals. */
function formatBbox(bounds: AreaBounds): string {
  const round = (value: number) => value.toFixed(6);
  return [bounds.minLon, bounds.minLat, bounds.maxLon, bounds.maxLat].map(round).join(",");
}

/** Comma-joined route ids for the `routeIds` query parameter; undefined when there are none. */
function joinRouteIds(routeIds: string[] | undefined): string | undefined {
  return routeIds !== undefined && routeIds.length > 0 ? routeIds.join(",") : undefined;
}

/** `&routeIds=...` (URL-encoded) to append to a query that already has parameters, or "". */
function routeIdsParam(routeIds: string[] | undefined): string {
  const joined = joinRouteIds(routeIds);
  return joined === undefined ? "" : `&routeIds=${encodeURIComponent(joined)}`;
}

export function createApiClient(options: ApiClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const root = `${options.baseUrl.replace(/\/$/, "")}/api/${API_VERSION}`;

  async function get<T>(path: string): Promise<T> {
    const headers: Record<string, string> = { accept: "application/json" };
    if (options.apiKey) headers[API_KEY_HEADER] = options.apiKey;
    const identity = options.getIdentity?.();
    if (identity) {
      headers[USER_NAME_HEADER] = encodeURIComponent(identity.userName);
      headers[INSTALL_ID_HEADER] = identity.installId;
    }

    const response = await fetchImpl(`${root}${path}`, { headers });
    if (!response.ok) {
      const body = (await response.json().catch(() => undefined)) as ApiErrorBody | undefined;
      throw new ApiError(
        response.status,
        body?.error.code ?? "http_error",
        body?.error.message ?? response.statusText,
      );
    }
    return (await response.json()) as T;
  }

  return {
    getNearbyStops: (params: {
      lat: number;
      lon: number;
      radius?: number;
      routeIds?: string[] | undefined;
    }) =>
      get<NearbyStopsResponse>(
        `/stops/nearby${buildQuery({
          lat: params.lat,
          lon: params.lon,
          radius: params.radius,
          routeIds: joinRouteIds(params.routeIds),
        })}`,
      ),

    search: (q: string) => get<SearchResponse>(`/search${buildQuery({ q })}`),

    getStopArrivals: (stopId: string) =>
      get<StopArrivalsResponse>(`/stops/${encodeURIComponent(stopId)}/arrivals`),

    getStopTimetable: (stopId: string, options: { date?: string } = {}) =>
      get<StopTimetableResponse>(
        `/stops/${encodeURIComponent(stopId)}/timetable${buildQuery({ date: options.date })}`,
      ),

    getRouteDetail: (
      routeId: string,
      options: { directionId?: 0 | 1; lat?: number; lon?: number } = {},
    ) =>
      get<RouteDetailResponse>(
        `/routes/${encodeURIComponent(routeId)}${buildQuery({
          directionId: options.directionId,
          lat: options.lat,
          lon: options.lon,
        })}`,
      ),

    getRouteVehicles: (routeId: string, options: { directionId?: 0 | 1 } = {}) =>
      get<RouteVehiclesResponse>(
        `/routes/${encodeURIComponent(routeId)}/vehicles${buildQuery({
          directionId: options.directionId,
        })}`,
      ),

    getVehicleDetail: (vehicleId: string) =>
      get<VehicleDetailResponse>(`/vehicles/${encodeURIComponent(vehicleId)}`),

    getStopsInArea: (bounds: AreaBounds, options: { routeIds?: string[] | undefined } = {}) =>
      get<StopsInAreaResponse>(
        `/stops/in-area?bbox=${formatBbox(bounds)}${routeIdsParam(options.routeIds)}`,
      ),

    getVehiclesInArea: (bounds: AreaBounds) =>
      get<VehiclesInAreaResponse>(`/vehicles/in-area?bbox=${formatBbox(bounds)}`),

    getHealth: () => get<HealthResponse>("/health"),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
