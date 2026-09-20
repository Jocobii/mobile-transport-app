import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { focusManager } from "@tanstack/react-query";
import { AppState } from "react-native";
import { readStored, removeStored, writeStored } from "@/shared/storage/storage";

/** Saves the persisted queries to MMKV (see `shouldPersistQuery`); writes are throttled. */
export const queryPersister = createAsyncStoragePersister({
  key: "query-cache",
  throttleTime: 2_000,
  storage: {
    getItem: (key) => readStored(key) ?? null,
    setItem: (key, value) => writeStored(key, value),
    removeItem: (key) => removeStored(key),
  },
});

/**
 * Tells TanStack Query when the app is in the foreground. Polling pauses in the background and
 * stale queries refetch on return, like the app's own poller did.
 */
export function bindFocusToAppState(): void {
  focusManager.setEventListener((handleFocus) => {
    const subscription = AppState.addEventListener("change", (status) =>
      handleFocus(status === "active"),
    );
    return () => subscription.remove();
  });
}
