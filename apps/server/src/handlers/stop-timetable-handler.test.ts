import type { StopTimetableResult } from "@transit/core";
import { CatalogUnavailableError } from "@transit/gtfs";
import { describe, expect, it, vi } from "vitest";
import { createStopTimetableHandler } from "./stop-timetable-handler";
import { authedRequest, fakeTransitService, OK_CONFIG, unauthedRequest } from "./test-helpers";

const RESULT: StopTimetableResult = {
  stop: { id: "56939", code: "56939", name: "MSP T1", lat: 44.88, lon: -93.2, feedIds: [] },
  serviceDate: "20260919",
  today: "20260919",
  availableDates: ["20260919"],
  groups: [],
};

function handlerWith(
  getStopTimetable: NonNullable<Parameters<typeof fakeTransitService>[0]["getStopTimetable"]>,
) {
  return createStopTimetableHandler({
    getService: () => fakeTransitService({ getStopTimetable }),
    readConfig: () => OK_CONFIG,
  });
}

const CONTEXT = { params: Promise.resolve({ stopId: "56939" }) };

describe("createStopTimetableHandler", () => {
  it("returns 200 with a catalog cache header", async () => {
    const handler = handlerWith(async () => RESULT);
    const response = await handler(
      authedRequest("https://x/api/v1/stops/56939/timetable"),
      CONTEXT,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, max-age=300");
    const body = await response.json();
    expect(body.serviceDate).toBe("20260919");
  });

  it("passes the stop id and the requested date to the service", async () => {
    const getStopTimetable = vi.fn(async () => RESULT);
    const handler = handlerWith(getStopTimetable);
    await handler(authedRequest("https://x/api/v1/stops/56939/timetable?date=20260920"), CONTEXT);
    expect(getStopTimetable).toHaveBeenCalledWith("56939", "20260920");
  });

  it("passes undefined when no date is given", async () => {
    const getStopTimetable = vi.fn(async () => RESULT);
    const handler = handlerWith(getStopTimetable);
    await handler(authedRequest("https://x/api/v1/stops/56939/timetable"), CONTEXT);
    expect(getStopTimetable).toHaveBeenCalledWith("56939", undefined);
  });

  it("returns 400 invalid_request for a malformed or impossible date", async () => {
    const getStopTimetable = vi.fn(async () => RESULT);
    const handler = handlerWith(getStopTimetable);
    for (const date of ["2026-09-20", "abc", "20261340"]) {
      const response = await handler(
        authedRequest(`https://x/api/v1/stops/56939/timetable?date=${date}`),
        CONTEXT,
      );
      expect(response.status).toBe(400);
    }
    expect(getStopTimetable).not.toHaveBeenCalled();
  });

  it("returns 400 invalid_request for an empty stopId", async () => {
    const handler = handlerWith(async () => RESULT);
    const response = await handler(authedRequest("https://x/api/v1/stops//timetable"), {
      params: Promise.resolve({ stopId: "" }),
    });
    expect(response.status).toBe(400);
  });

  it("returns 404 not_found for an unknown stop", async () => {
    const handler = handlerWith(async () => undefined);
    const response = await handler(authedRequest("https://x/api/v1/stops/nope/timetable"), {
      params: Promise.resolve({ stopId: "nope" }),
    });
    expect(response.status).toBe(404);
  });

  it("returns 401 unauthorized without an API key", async () => {
    const handler = handlerWith(async () => RESULT);
    const response = await handler(
      unauthedRequest("https://x/api/v1/stops/56939/timetable"),
      CONTEXT,
    );
    expect(response.status).toBe(401);
  });

  it("returns 503 catalog_unavailable when the catalog is missing", async () => {
    const handler = handlerWith(async () => {
      throw new CatalogUnavailableError("missing");
    });
    const response = await handler(
      authedRequest("https://x/api/v1/stops/56939/timetable"),
      CONTEXT,
    );
    expect(response.status).toBe(503);
  });
});
