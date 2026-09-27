import { API_KEY_HEADER, INSTALL_ID_HEADER, USER_NAME_HEADER } from "@transit/contracts";
import { describe, expect, it, vi } from "vitest";
import { ApiError, createApiClient } from "./index";

const BASE_URL = "https://example.test";

function fakeFetch(body: unknown, init: { status?: number; ok?: boolean } = {}) {
  const status = init.status ?? 200;
  const ok = init.ok ?? status < 400;
  return vi.fn(
    async () =>
      ({
        ok,
        status,
        statusText: "status",
        json: async () => body,
      }) as unknown as Response,
  );
}

describe("createApiClient", () => {
  describe("URL building", () => {
    it("getNearbyStops omits radius when not given", async () => {
      const fetchImpl = fakeFetch({ stops: [], outsideRadius: false, feeds: [] });
      const client = createApiClient({ baseUrl: BASE_URL, fetchImpl });

      await client.getNearbyStops({ lat: 44.88, lon: -93.2 });

      expect(fetchImpl).toHaveBeenCalledWith(
        `${BASE_URL}/api/v1/stops/nearby?lat=44.88&lon=-93.2`,
        expect.anything(),
      );
    });

    it("getNearbyStops includes radius when given", async () => {
      const fetchImpl = fakeFetch({ stops: [], outsideRadius: false, feeds: [] });
      const client = createApiClient({ baseUrl: BASE_URL, fetchImpl });

      await client.getNearbyStops({ lat: 44.88, lon: -93.2, radius: 750 });

      expect(fetchImpl).toHaveBeenCalledWith(
        `${BASE_URL}/api/v1/stops/nearby?lat=44.88&lon=-93.2&radius=750`,
        expect.anything(),
      );
    });

    it("getStopTimetable omits date when not given", async () => {
      const fetchImpl = fakeFetch({});
      const client = createApiClient({ baseUrl: BASE_URL, fetchImpl });

      await client.getStopTimetable("56939");

      expect(fetchImpl).toHaveBeenCalledWith(
        `${BASE_URL}/api/v1/stops/56939/timetable`,
        expect.anything(),
      );
    });

    it("getStopTimetable includes date and encodes the stop id", async () => {
      const fetchImpl = fakeFetch({});
      const client = createApiClient({ baseUrl: BASE_URL, fetchImpl });

      await client.getStopTimetable("a/b", { date: "20260920" });

      expect(fetchImpl).toHaveBeenCalledWith(
        `${BASE_URL}/api/v1/stops/a%2Fb/timetable?date=20260920`,
        expect.anything(),
      );
    });

    it("search encodes the query", async () => {
      const fetchImpl = fakeFetch({ routes: [], stops: [] });
      const client = createApiClient({ baseUrl: BASE_URL, fetchImpl });

      await client.search("436 V");

      expect(fetchImpl).toHaveBeenCalledWith(
        `${BASE_URL}/api/v1/search?q=436+V`,
        expect.anything(),
      );
    });

    it("getStopArrivals encodes the stop id", async () => {
      const fetchImpl = fakeFetch({ stop: {}, routes: [], arrivals: [], feeds: [] });
      const client = createApiClient({ baseUrl: BASE_URL, fetchImpl });

      await client.getStopArrivals("56939");

      expect(fetchImpl).toHaveBeenCalledWith(
        `${BASE_URL}/api/v1/stops/56939/arrivals`,
        expect.anything(),
      );
    });

    it("getRouteDetail encodes the route id and omits unset options", async () => {
      const fetchImpl = fakeFetch({
        route: {},
        directions: [],
        selectedDirectionId: 0,
        stops: [],
        shape: [],
      });
      const client = createApiClient({ baseUrl: BASE_URL, fetchImpl });

      await client.getRouteDetail("mvta:436");

      expect(fetchImpl).toHaveBeenCalledWith(
        `${BASE_URL}/api/v1/routes/mvta%3A436`,
        expect.anything(),
      );
    });

    it("getRouteDetail includes directionId and lat/lon when given", async () => {
      const fetchImpl = fakeFetch({
        route: {},
        directions: [],
        selectedDirectionId: 1,
        stops: [],
        shape: [],
      });
      const client = createApiClient({ baseUrl: BASE_URL, fetchImpl });

      await client.getRouteDetail("mvta:436", { directionId: 1, lat: 44.88, lon: -93.2 });

      expect(fetchImpl).toHaveBeenCalledWith(
        `${BASE_URL}/api/v1/routes/mvta%3A436?directionId=1&lat=44.88&lon=-93.2`,
        expect.anything(),
      );
    });

    it("getRouteVehicles encodes the route id and omits unset directionId", async () => {
      const fetchImpl = fakeFetch({ routeId: "mvta:436", vehicles: [], feeds: [] });
      const client = createApiClient({ baseUrl: BASE_URL, fetchImpl });

      await client.getRouteVehicles("mvta:436");

      expect(fetchImpl).toHaveBeenCalledWith(
        `${BASE_URL}/api/v1/routes/mvta%3A436/vehicles`,
        expect.anything(),
      );
    });

    it("getRouteVehicles includes directionId when given", async () => {
      const fetchImpl = fakeFetch({ routeId: "mvta:436", vehicles: [], feeds: [] });
      const client = createApiClient({ baseUrl: BASE_URL, fetchImpl });

      await client.getRouteVehicles("mvta:436", { directionId: 0 });

      expect(fetchImpl).toHaveBeenCalledWith(
        `${BASE_URL}/api/v1/routes/mvta%3A436/vehicles?directionId=0`,
        expect.anything(),
      );
    });

    it("getVehicleDetail encodes the vehicle id", async () => {
      const fetchImpl = fakeFetch({ vehicle: {}, route: {}, upcomingStops: [], feeds: [] });
      const client = createApiClient({ baseUrl: BASE_URL, fetchImpl });

      await client.getVehicleDetail("mvta:4266");

      expect(fetchImpl).toHaveBeenCalledWith(
        `${BASE_URL}/api/v1/vehicles/mvta%3A4266`,
        expect.anything(),
      );
    });

    it("getHealth calls the health endpoint", async () => {
      const fetchImpl = fakeFetch({ status: "ok", checkedAt: 0, feeds: [] });
      const client = createApiClient({ baseUrl: BASE_URL, fetchImpl });

      await client.getHealth();

      expect(fetchImpl).toHaveBeenCalledWith(`${BASE_URL}/api/v1/health`, expect.anything());
    });

    it("getStopsInArea builds bbox as minLon,minLat,maxLon,maxLat with 6 decimals", async () => {
      const fetchImpl = fakeFetch({ stops: [], truncated: false });
      const client = createApiClient({ baseUrl: BASE_URL, fetchImpl });

      await client.getStopsInArea({ minLat: 44.97, minLon: -93.28, maxLat: 44.99, maxLon: -93.25 });

      expect(fetchImpl).toHaveBeenCalledWith(
        `${BASE_URL}/api/v1/stops/in-area?bbox=-93.280000,44.970000,-93.250000,44.990000`,
        expect.anything(),
      );
    });

    it("getNearbyStops includes encoded routeIds when given and omits them when empty", async () => {
      const fetchImpl = fakeFetch({ stops: [], outsideRadius: false, feeds: [] });
      const client = createApiClient({ baseUrl: BASE_URL, fetchImpl });

      await client.getNearbyStops({
        lat: 44.88,
        lon: -93.2,
        routeIds: ["mvta:436", "metrotransit:68"],
      });
      await client.getNearbyStops({ lat: 44.88, lon: -93.2, routeIds: [] });

      expect(fetchImpl).toHaveBeenNthCalledWith(
        1,
        `${BASE_URL}/api/v1/stops/nearby?lat=44.88&lon=-93.2&routeIds=mvta%3A436%2Cmetrotransit%3A68`,
        expect.anything(),
      );
      expect(fetchImpl).toHaveBeenNthCalledWith(
        2,
        `${BASE_URL}/api/v1/stops/nearby?lat=44.88&lon=-93.2`,
        expect.anything(),
      );
    });

    it("getStopsInArea appends encoded routeIds after the bbox when given", async () => {
      const fetchImpl = fakeFetch({ stops: [], truncated: false });
      const client = createApiClient({ baseUrl: BASE_URL, fetchImpl });

      await client.getStopsInArea(
        { minLat: 44.97, minLon: -93.28, maxLat: 44.99, maxLon: -93.25 },
        { routeIds: ["mvta:436", "metrotransit:68"] },
      );

      expect(fetchImpl).toHaveBeenCalledWith(
        `${BASE_URL}/api/v1/stops/in-area?bbox=-93.280000,44.970000,-93.250000,44.990000&routeIds=mvta%3A436%2Cmetrotransit%3A68`,
        expect.anything(),
      );
    });

    it("getVehiclesInArea builds bbox as minLon,minLat,maxLon,maxLat with 6 decimals", async () => {
      const fetchImpl = fakeFetch({ vehicles: [], truncated: false, feeds: [] });
      const client = createApiClient({ baseUrl: BASE_URL, fetchImpl });

      await client.getVehiclesInArea({
        minLat: 44.85,
        minLon: -93.4,
        maxLat: 45.05,
        maxLon: -93.1,
      });

      expect(fetchImpl).toHaveBeenCalledWith(
        `${BASE_URL}/api/v1/vehicles/in-area?bbox=-93.400000,44.850000,-93.100000,45.050000`,
        expect.anything(),
      );
    });
  });

  describe("x-api-key header", () => {
    it("is sent when an api key is configured", async () => {
      const fetchImpl = fakeFetch({ status: "ok", checkedAt: 0, feeds: [] });
      const client = createApiClient({ baseUrl: BASE_URL, apiKey: "secret", fetchImpl });

      await client.getHealth();

      const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
      expect((init.headers as Record<string, string>)[API_KEY_HEADER]).toBe("secret");
    });

    it("is omitted when no api key is configured", async () => {
      const fetchImpl = fakeFetch({ status: "ok", checkedAt: 0, feeds: [] });
      const client = createApiClient({ baseUrl: BASE_URL, fetchImpl });

      await client.getHealth();

      const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
      expect(API_KEY_HEADER in (init.headers as Record<string, string>)).toBe(false);
    });
  });

  describe("error mapping", () => {
    it("throws ApiError with the code and message from the response body", async () => {
      const fetchImpl = fakeFetch(
        { error: { code: "not_found", message: "stop not found" } },
        { status: 404, ok: false },
      );
      const client = createApiClient({ baseUrl: BASE_URL, fetchImpl });

      await expect(client.getStopArrivals("missing")).rejects.toMatchObject({
        status: 404,
        code: "not_found",
        message: "stop not found",
      });
    });

    it("is an instance of ApiError", async () => {
      const fetchImpl = fakeFetch(
        { error: { code: "unauthorized", message: "no key" } },
        { status: 401, ok: false },
      );
      const client = createApiClient({ baseUrl: BASE_URL, fetchImpl });

      await expect(client.getHealth()).rejects.toBeInstanceOf(ApiError);
    });

    it("falls back to http_error when the body is not a valid error shape", async () => {
      const fetchImpl = vi.fn(
        async () =>
          ({
            ok: false,
            status: 502,
            statusText: "Bad Gateway",
            json: async () => {
              throw new Error("not json");
            },
          }) as unknown as Response,
      );
      const client = createApiClient({ baseUrl: BASE_URL, fetchImpl });

      await expect(client.getHealth()).rejects.toMatchObject({
        status: 502,
        code: "http_error",
        message: "Bad Gateway",
      });
    });
  });

  describe("identity headers", () => {
    function headersOf(
      fetchImpl: ReturnType<typeof fakeFetch>,
      callIndex = 0,
    ): Record<string, string> {
      const [, init] = fetchImpl.mock.calls[callIndex] as unknown as [string, RequestInit];
      return init.headers as Record<string, string>;
    }

    it("sends no identity headers when getIdentity is not given", async () => {
      const fetchImpl = fakeFetch({ status: "ok", checkedAt: 0, feeds: [] });
      const client = createApiClient({ baseUrl: BASE_URL, fetchImpl });

      await client.getHealth();

      const headers = headersOf(fetchImpl);
      expect(USER_NAME_HEADER in headers).toBe(false);
      expect(INSTALL_ID_HEADER in headers).toBe(false);
    });

    it("sends no identity headers when getIdentity returns undefined", async () => {
      const fetchImpl = fakeFetch({ status: "ok", checkedAt: 0, feeds: [] });
      const client = createApiClient({
        baseUrl: BASE_URL,
        fetchImpl,
        getIdentity: () => undefined,
      });

      await client.getHealth();

      const headers = headersOf(fetchImpl);
      expect(USER_NAME_HEADER in headers).toBe(false);
      expect(INSTALL_ID_HEADER in headers).toBe(false);
    });

    it("sends both identity headers, URI-encoding the name", async () => {
      const fetchImpl = fakeFetch({ status: "ok", checkedAt: 0, feeds: [] });
      const client = createApiClient({
        baseUrl: BASE_URL,
        fetchImpl,
        getIdentity: () => ({ userName: "José 🚌", installId: "0123456789abcdef" }),
      });

      await client.getHealth();

      const headers = headersOf(fetchImpl);
      expect(headers[USER_NAME_HEADER]).toBe(encodeURIComponent("José 🚌"));
      expect(headers[INSTALL_ID_HEADER]).toBe("0123456789abcdef");
    });

    it("reads getIdentity again on every request", async () => {
      const fetchImpl = fakeFetch({ status: "ok", checkedAt: 0, feeds: [] });
      let identity: { userName: string; installId: string } | undefined;
      const client = createApiClient({
        baseUrl: BASE_URL,
        fetchImpl,
        getIdentity: () => identity,
      });

      await client.getHealth();
      expect(USER_NAME_HEADER in headersOf(fetchImpl, 0)).toBe(false);

      identity = { userName: "Ana", installId: "abcdef0123456789" };
      await client.getHealth();
      const secondHeaders = headersOf(fetchImpl, 1);
      expect(secondHeaders[USER_NAME_HEADER]).toBe("Ana");
      expect(secondHeaders[INSTALL_ID_HEADER]).toBe("abcdef0123456789");
    });
  });
});
