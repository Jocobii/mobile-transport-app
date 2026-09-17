import { describe, expect, it } from "vitest";
import { addDays, epochFor, GtfsParseError, localServiceDate, parseGtfsTime } from "./gtfs-time";

const CHICAGO = "America/Chicago";

describe("parseGtfsTime", () => {
  it("parses a normal time", () => {
    expect(parseGtfsTime("08:00:00")).toBe(8 * 3600);
  });

  it("parses a time past midnight (≥ 24:00:00)", () => {
    expect(parseGtfsTime("25:10:00")).toBe(90600);
  });

  it("throws GtfsParseError on an invalid format", () => {
    expect(() => parseGtfsTime("not-a-time")).toThrow(GtfsParseError);
  });

  it("includes the file and row in the error when given a location", () => {
    expect(() => parseGtfsTime("bad", { file: "stop_times.txt", row: 42 })).toThrow(
      /stop_times\.txt:42/,
    );
  });
});

describe("epochFor", () => {
  it("converts a normal local time to epoch", () => {
    expect(epochFor("20260916", 8 * 3600, CHICAGO)).toBe(Date.UTC(2026, 8, 16, 13, 0, 0) / 1000);
  });

  it("converts a time ≥ 24:00:00 into the next local day", () => {
    expect(epochFor("20260916", 25 * 3600 + 10 * 60, CHICAGO)).toBe(
      Date.UTC(2026, 8, 17, 6, 10, 0) / 1000,
    );
  });

  it("uses the post-transition offset on the DST start date (2026-03-08)", () => {
    // 03:00 local is the first minute of CDT (clocks jumped 02:00 -> 03:00).
    expect(epochFor("20260308", 3 * 3600, CHICAGO)).toBe(Date.UTC(2026, 2, 8, 8, 0, 0) / 1000);
  });

  it("uses the post-transition offset on the DST end date (2026-11-01)", () => {
    // 03:00 local is after the fall-back (clocks moved 02:00 -> 01:00), back to CST.
    expect(epochFor("20261101", 3 * 3600, CHICAGO)).toBe(Date.UTC(2026, 10, 1, 9, 0, 0) / 1000);
  });
});

describe("localServiceDate", () => {
  it("returns the local calendar date for an epoch", () => {
    const epoch = epochFor("20260916", 8 * 3600, CHICAGO);
    expect(localServiceDate(epoch, CHICAGO)).toBe("20260916");
  });

  it("rolls over to the next local day near midnight", () => {
    const epoch = epochFor("20260916", 25 * 3600 + 10 * 60, CHICAGO);
    expect(localServiceDate(epoch, CHICAGO)).toBe("20260917");
  });
});

describe("addDays", () => {
  it("adds days within a month", () => {
    expect(addDays("20260308", 1)).toBe("20260309");
  });

  it("rolls over a year boundary", () => {
    expect(addDays("20261231", 1)).toBe("20270101");
  });

  it("subtracts days across a year boundary", () => {
    expect(addDays("20260101", -1)).toBe("20251231");
  });
});
