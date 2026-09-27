/**
 * Geometry of the animated brand splash (pure: no React Native imports, so it is unit tested).
 * Everything is in dp and laid out around the screen center, where the native splash draws the pin.
 */

/**
 * Height of the pin in the native splash, in dp: `imageWidth` in `app.config.ts` (260) times the
 * share of `splash-icon.png` the pin takes (616 of 1024 px). The overlay starts at this exact size
 * so the hand-off from the native splash is invisible.
 */
export const NATIVE_SPLASH_PIN_HEIGHT = 156;

/** How much the pin grows while the scene is revealed. */
export const SPLASH_PIN_GROWTH = 1.3;

/** The pin's bounding box in the 1024-unit icon artwork (see `PinArt`). */
export const PIN_ART = { centerX: 512, centerY: 489, height: 642 } as const;

export interface SplashSceneInput {
  width: number;
  height: number;
  /** Pin height in dp at the end of the reveal. */
  pinHeight: number;
}

export interface SplashScene {
  /** Tip of the pin, where it stands on the river bank. */
  tip: { x: number; y: number };
  /** Lighter, nearer river band (its top edge is the west bank the pin stands on). */
  riverNear: string;
  /** Darker, farther river band drawn on top of the near one. */
  riverFar: string;
  /** Eight-point North Star, up and to the left of the pin. */
  star: string;
  /** SVG transform that places the 1024-unit pin artwork centered on screen at `pinHeight`. */
  pinTransform: string;
}

/** How far the river bands extend past the tip, in pin heights; wide enough for tablets and the grow animation. */
const RIVER_REACH = 3.2;
const RIVER_DEPTH = 9;

/** 8-point star path centered on (cx, cy), first point straight up. */
export function starPath(cx: number, cy: number, outer: number, inner: number, points = 8): string {
  const vertices: string[] = [];
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = ((-90 + (i * 180) / points) * Math.PI) / 180;
    vertices.push(
      `${round(cx + radius * Math.cos(angle))},${round(cy + radius * Math.sin(angle))}`,
    );
  }
  return `M${vertices.join(" L")} Z`;
}

export function buildSplashScene({ width, height, pinHeight }: SplashSceneInput): SplashScene {
  const centerX = width / 2;
  const centerY = height / 2;
  const tip = { x: centerX, y: centerY + pinHeight / 2 };
  // Points in pin-height units relative to the tip, so the scene keeps its proportions on any screen.
  const at = (x: number, y: number) =>
    `${round(tip.x + x * pinHeight)},${round(tip.y + y * pinHeight)}`;
  const closeBand = `L${at(-RIVER_REACH, RIVER_DEPTH)} L${at(RIVER_REACH, RIVER_DEPTH)} Z`;

  const riverNear =
    `M${at(RIVER_REACH, -2.4)} C${at(1.7, -1.5)} ${at(1.5, -0.45)} ${at(0.55, -0.08)} ` +
    `C${at(0.1, 0.1)} ${at(-0.9, 0.1)} ${at(-RIVER_REACH, 0.95)} ${closeBand}`;
  const riverFar =
    `M${at(RIVER_REACH, -1.5)} C${at(2, -0.7)} ${at(1.7, 0.35)} ${at(0.8, 0.6)} ` +
    `C${at(0, 0.85)} ${at(-1.1, 0.8)} ${at(-RIVER_REACH, 1.7)} ${closeBand}`;

  const star = starPath(
    tip.x - 0.72 * pinHeight,
    tip.y - 1.2 * pinHeight,
    0.13 * pinHeight,
    0.062 * pinHeight,
  );

  const scale = pinHeight / PIN_ART.height;
  const pinTransform =
    `translate(${round(centerX)} ${round(centerY)}) scale(${round(scale, 5)}) ` +
    `translate(${-PIN_ART.centerX} ${-PIN_ART.centerY})`;

  return { tip, riverNear, riverFar, star, pinTransform };
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
