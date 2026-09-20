import * as SplashScreen from "expo-splash-screen";

/** The splash never stays longer than this, even if the map does not report ready. */
export const SPLASH_MAX_MS = 4_000;

/** Keeps the splash on screen until `hideSplash()`; call before the first render. */
export function keepSplashVisible(): void {
  SplashScreen.preventAutoHideAsync().catch(() => undefined);
}

/** Hides the splash. Safe to call more than once. */
export function hideSplash(): void {
  SplashScreen.hideAsync().catch(() => undefined);
}
