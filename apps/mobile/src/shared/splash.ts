import * as SplashScreen from "expo-splash-screen";
import { splashGate } from "./splash-gate";

/** The splash never stays longer than this, even if the map does not report ready. */
export const SPLASH_MAX_MS = 4_000;

/** The brand splash stays at least this long after it appears, so the logo can be seen. */
export const BRAND_SPLASH_MIN_MS = 1_600;
/** Duration of the reveal: sky, river and star fade in while the pin grows. */
export const BRAND_SPLASH_REVEAL_MS = 700;
/** Duration of the final fade into the app. */
export const BRAND_SPLASH_FADE_MS = 350;

/** Keeps the native splash on screen; call before the first render. */
export function keepSplashVisible(): void {
  SplashScreen.preventAutoHideAsync().catch(() => undefined);
}

/** Hides the native splash. `BrandSplash` calls it once it covers the screen. Safe to call more than once. */
export function hideNativeSplash(): void {
  SplashScreen.hideAsync().catch(() => undefined);
}

/**
 * The app content is ready: the native splash goes away and the brand splash fades out once it
 * has been on screen for `BRAND_SPLASH_MIN_MS`. Safe to call more than once.
 */
export function hideSplash(): void {
  hideNativeSplash();
  splashGate.markReady();
}
