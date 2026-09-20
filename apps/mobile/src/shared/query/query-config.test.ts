import { describe, expect, it } from "vitest";
import {
  createQueryClient,
  PERSIST_META,
  QUERY_CACHE_MAX_AGE_MS,
  QUERY_STALE_TIME_MS,
  shouldPersistQuery,
} from "./query-config";

describe("createQueryClient", () => {
  it("does not retry (polling retries), and keeps data at least as long as it is restorable", () => {
    const options = createQueryClient().getDefaultOptions().queries;
    expect(options?.retry).toBe(false);
    expect(options?.staleTime).toBe(QUERY_STALE_TIME_MS);
    expect(options?.gcTime).toBeGreaterThanOrEqual(QUERY_CACHE_MAX_AGE_MS);
  });
});

describe("shouldPersistQuery", () => {
  it("saves successful queries marked to persist", () => {
    expect(shouldPersistQuery({ meta: PERSIST_META, state: { status: "success" } })).toBe(true);
  });

  it("skips queries that are not marked", () => {
    expect(shouldPersistQuery({ meta: undefined, state: { status: "success" } })).toBe(false);
    expect(shouldPersistQuery({ meta: { persist: false }, state: { status: "success" } })).toBe(
      false,
    );
  });

  it("skips queries without a successful response", () => {
    expect(shouldPersistQuery({ meta: PERSIST_META, state: { status: "error" } })).toBe(false);
    expect(shouldPersistQuery({ meta: PERSIST_META, state: { status: "pending" } })).toBe(false);
  });
});
