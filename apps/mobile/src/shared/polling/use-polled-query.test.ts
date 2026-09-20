import { describe, expect, it } from "vitest";
import { toPolledQuery } from "./use-polled-query";

const noop = () => undefined;

describe("toPolledQuery", () => {
  it("is loading while enabled with no data and no error", () => {
    const query = toPolledQuery(
      { data: undefined, error: null, isFetching: true, dataUpdatedAt: 0 },
      true,
      noop,
    );
    expect(query.isInitialLoading).toBe(true);
    expect(query.isFetching).toBe(true);
    expect(query.lastSuccessAt).toBeUndefined();
  });

  it("is idle, not loading, while disabled", () => {
    const query = toPolledQuery(
      { data: undefined, error: null, isFetching: false, dataUpdatedAt: 0 },
      false,
      noop,
    );
    expect(query.isInitialLoading).toBe(false);
    expect(query.isFetching).toBe(false);
  });

  it("reports the last success in epoch seconds", () => {
    const query = toPolledQuery(
      { data: { ok: true }, error: null, isFetching: false, dataUpdatedAt: 1_700_000_123_456 },
      true,
      noop,
    );
    expect(query.lastSuccessAt).toBe(1_700_000_123);
    expect(query.isInitialLoading).toBe(false);
  });

  it("keeps the data when a refresh fails", () => {
    const failure = new Error("offline");
    const query = toPolledQuery(
      { data: [1], error: failure, isFetching: false, dataUpdatedAt: 5_000 },
      true,
      noop,
    );
    expect(query.data).toEqual([1]);
    expect(query.error).toBe(failure);
    expect(query.isInitialLoading).toBe(false);
  });

  it("stops the loading state when the first load fails", () => {
    const query = toPolledQuery(
      { data: undefined, error: new Error("boom"), isFetching: false, dataUpdatedAt: 0 },
      true,
      noop,
    );
    expect(query.isInitialLoading).toBe(false);
    expect(query.error).toBeInstanceOf(Error);
  });
});
