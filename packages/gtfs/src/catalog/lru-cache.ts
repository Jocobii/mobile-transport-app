/** Small least-recently-used cache: `get` and `set` mark an entry as fresh; the oldest is evicted. */
export interface LruCache<K, V> {
  get(key: K): V | undefined;
  set(key: K, value: V): void;
  readonly size: number;
}

export function createLruCache<K, V>(maxEntries: number): LruCache<K, V> {
  const entries = new Map<K, V>();

  return {
    get(key) {
      if (!entries.has(key)) return undefined;
      const value = entries.get(key) as V;
      entries.delete(key);
      entries.set(key, value);
      return value;
    },
    set(key, value) {
      entries.delete(key);
      entries.set(key, value);
      if (entries.size > maxEntries) {
        const oldest = entries.keys().next().value as K;
        entries.delete(oldest);
      }
    },
    get size() {
      return entries.size;
    },
  };
}
