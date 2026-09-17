import type { Cache, Clock } from "@transit/core";

interface Entry {
  value: unknown;
  expiresAt: number;
}

/**
 * Per-instance in-memory cache with expiration. Occasional extra work across
 * separate function instances is expected and acceptable (EPIC-001 section 16).
 */
export function createInMemoryCache(clock: Clock): Cache {
  const entries = new Map<string, Entry>();

  return {
    async get<T>(key: string): Promise<T | undefined> {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (clock.now() >= entry.expiresAt) {
        entries.delete(key);
        return undefined;
      }
      return entry.value as T;
    },

    async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
      entries.set(key, { value, expiresAt: clock.now() + ttlSeconds });
    },
  };
}
