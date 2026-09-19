import { describe, expect, it } from "vitest";
import { findNextDeparture, formatServiceDayLabel, groupTimesByHour } from "./timetable";

/** Epoch seconds for a LOCAL date and time, so the tests do not depend on the machine's zone. */
function local(month: number, day: number, hour: number, minute: number): number {
  return new Date(2026, month - 1, day, hour, minute).getTime() / 1000;
}

describe("groupTimesByHour", () => {
  it("returns no rows for no departures", () => {
    expect(groupTimesByHour([])).toEqual([]);
  });

  it("groups minutes by local hour and pads them to two digits", () => {
    const rows = groupTimesByHour([
      local(9, 19, 5, 5),
      local(9, 19, 5, 35),
      local(9, 19, 6, 0),
      local(9, 19, 6, 20),
    ]);
    expect(rows.map((row) => [row.hour12, row.period, row.minutes.map((m) => m.text)])).toEqual([
      [5, "am", ["05", "35"]],
      [6, "am", ["00", "20"]],
    ]);
  });

  it("keeps the epoch time of every minute", () => {
    const time = local(9, 19, 5, 5);
    expect(groupTimesByHour([time])[0]?.minutes[0]?.time).toBe(time);
  });

  it("labels noon as 12 p. m. and midnight as 12 a. m.", () => {
    const rows = groupTimesByHour([
      local(9, 19, 0, 10),
      local(9, 19, 12, 10),
      local(9, 19, 13, 10),
    ]);
    expect(rows.map((row) => [row.hour12, row.period])).toEqual([
      [12, "am"],
      [12, "pm"],
      [1, "pm"],
    ]);
  });

  it("starts a new row when the calendar date changes even if the hour repeats", () => {
    const rows = groupTimesByHour([local(9, 19, 23, 50), local(9, 20, 0, 15), local(9, 20, 1, 5)]);
    expect(rows.map((row) => [row.hour12, row.period])).toEqual([
      [11, "pm"],
      [12, "am"],
      [1, "am"],
    ]);
  });

  it("gives every row a unique key", () => {
    const rows = groupTimesByHour([local(9, 19, 5, 5), local(9, 19, 6, 5), local(9, 20, 5, 5)]);
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
  });
});

describe("findNextDeparture", () => {
  const times = [100, 200, 300];

  it("returns the first time when now is before all of them", () => {
    expect(findNextDeparture(times, 50)).toBe(100);
  });

  it("returns the next time between two departures", () => {
    expect(findNextDeparture(times, 150)).toBe(200);
  });

  it("counts a departure exactly at now as next", () => {
    expect(findNextDeparture(times, 200)).toBe(200);
  });

  it("returns undefined after the last departure or with no times", () => {
    expect(findNextDeparture(times, 301)).toBeUndefined();
    expect(findNextDeparture([], 0)).toBeUndefined();
  });
});

describe("formatServiceDayLabel", () => {
  const labels = {
    today: "Hoy",
    tomorrow: "Mañana",
    weekdays: ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"],
  };

  it("labels today and tomorrow", () => {
    expect(formatServiceDayLabel("20260919", "20260919", labels)).toBe("Hoy");
    expect(formatServiceDayLabel("20260920", "20260919", labels)).toBe("Mañana");
  });

  it("labels other days with the weekday and the day of the month", () => {
    expect(formatServiceDayLabel("20260921", "20260919", labels)).toBe("lun 21");
    expect(formatServiceDayLabel("20260925", "20260919", labels)).toBe("vie 25");
  });

  it("uses index 0 for Sunday and 6 for Saturday", () => {
    expect(formatServiceDayLabel("20260927", "20260919", labels)).toBe("dom 27");
    expect(formatServiceDayLabel("20261003", "20260919", labels)).toBe("sáb 3");
  });

  it("finds tomorrow across month and year rollovers", () => {
    expect(formatServiceDayLabel("20261001", "20260930", labels)).toBe("Mañana");
    expect(formatServiceDayLabel("20270101", "20261231", labels)).toBe("Mañana");
    expect(formatServiceDayLabel("20280229", "20280228", labels)).toBe("Mañana");
  });
});
