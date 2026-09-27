/**
 * "The app is ready" signal for the brand splash (pure: no React Native imports).
 * Screens call `hideSplash()` (in `splash.ts`), which marks the gate; `BrandSplash` subscribes to it.
 */

type Listener = () => void;

export interface SplashGate {
  markReady(): void;
  isReady(): boolean;
  subscribe(listener: Listener): () => void;
}

export function createSplashGate(): SplashGate {
  let ready = false;
  const listeners = new Set<Listener>();
  return {
    markReady() {
      if (ready) return;
      ready = true;
      for (const listener of listeners) listener();
    },
    isReady: () => ready,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The single gate the app uses. */
export const splashGate = createSplashGate();

/** Milliseconds to wait before the brand splash fades out, so it stays on screen at least `minMs`. */
export function brandSplashDismissDelay(shownForMs: number, minMs: number): number {
  return Math.max(0, minMs - shownForMs);
}
