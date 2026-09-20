import { describe, expect, it } from "vitest";
import {
  findNextDeparture,
  formatClockTime,
  formatCountdown,
  formatServiceDayLabel,
  groupTimesByDayPart,
  splitPassedTimes,
  stepServiceDate,
  typicalHeadwayMinutes,
} from "./timetable";

/** Epoch seconds for a LOCAL date and time, so the tests do not depend on the machine's zone. */
function local(month: number, day: number, hour: number, minute: number): number {
  return new Date(2026, month - 1, day, hour, minute).getTime() / 1000;
}

describe("formatClockTime", () => {
  it("formats morning times as h:mm am", () => {
    expect(formatClockTime(local(9, 20, 6, 5))).toEqual({ text: "6:05", period: "am" });
  });

  it("formats noon and midnight as 12", () => {
    expect(formatClockTime(local(9, 20, 12, 24))).toEqual({ text: "12:24", period: "pm" });
    expect(formatClockTime(local(9, 20, 0, 10))).toEqual({ text: "12:10", period: "am" });
  });

  it("formats evening times as pm", () => {
    expect(formatClockTime(local(9, 20, 23, 59))).toEqual({ text: "11:59", period: "pm" });
  });
});

describe("groupTimesByDayPart", () => {
  it("returns no sections without times", () => {
    expect(groupTimesByDayPart([])).toEqual([]);
  });

  it("splits the day at 5, 12 and 19 h", () => {
    const sections = groupTimesByDayPart([
      local(9, 20, 4, 50),
      local(9, 20, 5, 0),
      local(9, 20, 11, 59),
      local(9, 20, 12, 0),
      local(9, 20, 18, 59),
      local(9, 20, 19, 0),
    ]);
    expect(sections.map((section) => [section.part, section.times.length])).toEqual([
      ["earlyMorning", 1],
      ["morning", 2],
      ["afternoon", 2],
      ["night", 1],
    ]);
  });

  it("puts departures on a later calendar date after midnight, not in the morning", () => {
    const sections = groupTimesByDayPart([
      local(9, 20, 22, 0),
      local(9, 21, 0, 15),
      local(9, 21, 1, 5),
    ]);
    expect(sections.map((section) => section.part)).toEqual(["night", "afterMidnight"]);
    expect(sections[1]?.times).toHaveLength(2);
  });

  it("keeps the order of the input", () => {
    const times = [local(9, 20, 6, 0), local(9, 20, 7, 0), local(9, 20, 13, 0)];
    expect(groupTimesByDayPart(times).flatMap((section) => section.times)).toEqual(times);
  });
});

describe("typicalHeadwayMinutes", () => {
  const every = (minutes: number, count: number) =>
    Array.from({ length: count }, (_, index) => local(9, 20, 6, 0) + index * minutes * 60);

  it("is undefined with fewer than 4 departures", () => {
    expect(typicalHeadwayMinutes(every(30, 3))).toBeUndefined();
  });

  it("rounds to 5 min from 10 min up", () => {
    expect(typicalHeadwayMinutes(every(59, 6))).toBe(60);
    expect(typicalHeadwayMinutes(every(22, 6))).toBe(20);
  });

  it("keeps whole minutes below 10 min", () => {
    expect(typicalHeadwayMinutes(every(7, 6))).toBe(7);
  });

  it("uses the median, so one long gap does not change it", () => {
    const times = [...every(15, 5), local(9, 20, 12, 0)];
    expect(typicalHeadwayMinutes(times)).toBe(15);
  });
});

describe("formatCountdown", () => {
  it("says now under a minute", () => {
    expect(formatCountdown(59)).toEqual({ key: "now", params: {} });
  });

  it("uses minutes under an hour", () => {
    expect(formatCountdown(45 * 60 + 30)).toEqual({ key: "minutes", params: { minutes: 45 } });
  });

  it("uses hours and minutes", () => {
    expect(formatCountdown(4 * 3600 + 30 * 60)).toEqual({
      key: "hoursMinutes",
      params: { hours: 4, minutes: 30 },
    });
  });

  it("drops zero minutes", () => {
    expect(formatCountdown(2 * 3600)).toEqual({ key: "hours", params: { hours: 2 } });
  });
});

describe("splitPassedTimes", () => {
  const times = [100, 200, 300];

  it("splits at the first departure at or after now", () => {
    expect(splitPassedTimes(times, 200)).toEqual({ passed: [100], upcoming: [200, 300] });
  });

  it("returns everything as passed after the last one", () => {
    expect(splitPassedTimes(times, 301)).toEqual({ passed: [100, 200, 300], upcoming: [] });
  });

  it("returns nothing passed before the first one", () => {
    expect(splitPassedTimes(times, 50)).toEqual({ passed: [], upcoming: [100, 200, 300] });
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

describe("stepServiceDate", () => {
  const dates = ["20260920", "20260921", "20260922"];

  it("moves to the next day", () => {
    expect(stepServiceDate(dates, "20260920", "next")).toBe("20260921");
  });

  it("moves to the previous day", () => {
    expect(stepServiceDate(dates, "20260922", "previous")).toBe("20260921");
  });

  it("stops at the last day", () => {
    expect(stepServiceDate(dates, "20260922", "next")).toBeUndefined();
  });

  it("stops at the first day", () => {
    expect(stepServiceDate(dates, "20260920", "previous")).toBeUndefined();
  });

  it("returns undefined when the current day is not available", () => {
    expect(stepServiceDate(dates, "20261231", "next")).toBeUndefined();
  });

  it("returns undefined without dates", () => {
    expect(stepServiceDate([], "20260920", "next")).toBeUndefined();
  });
});
