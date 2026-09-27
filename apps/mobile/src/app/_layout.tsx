import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { prewarmServer } from "@/api/prewarm";
import { IdentityGate } from "@/features/identity/IdentityGate";
import { BrandSplash } from "@/shared/components/BrandSplash";
import {
  createQueryClient,
  PERSIST_CACHE_VERSION,
  QUERY_CACHE_MAX_AGE_MS,
  shouldPersistQuery,
} from "@/shared/query/query-config";
import { bindFocusToAppState, queryPersister } from "@/shared/query/query-persistence";
import { hideSplash, keepSplashVisible, SPLASH_MAX_MS } from "@/shared/splash";
import "@/i18n";

const queryClient = createQueryClient();
bindFocusToAppState();
keepSplashVisible();
prewarmServer();

const persistOptions = {
  persister: queryPersister,
  maxAge: QUERY_CACHE_MAX_AGE_MS,
  buster: PERSIST_CACHE_VERSION,
  dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
};

export default function RootLayout() {
  // Fallback: the home screen hides the splash when the map is ready.
  useEffect(() => {
    const timer = setTimeout(hideSplash, SPLASH_MAX_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <IdentityGate>
            <Stack screenOptions={{ headerShown: false }} />
          </IdentityGate>
          <BrandSplash />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </PersistQueryClientProvider>
  );
}
