import { createMMKV } from "react-native-mmkv";

const mmkv = createMMKV({ id: "transit-app" });

/**
 * Synchronous key-value storage on MMKV. Reads are instant, so state can be restored before the
 * first render. Calls never throw: a failed read returns `undefined` and a failed write is dropped.
 */
export function readStored(key: string): string | undefined {
  try {
    return mmkv.getString(key);
  } catch {
    return undefined;
  }
}

export function writeStored(key: string, value: string): void {
  try {
    mmkv.set(key, value);
  } catch {
    // Persistence is best effort.
  }
}

export function removeStored(key: string): void {
  try {
    mmkv.remove(key);
  } catch {
    // Persistence is best effort.
  }
}
