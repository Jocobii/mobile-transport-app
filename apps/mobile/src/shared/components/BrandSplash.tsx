import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { type LayoutChangeEvent, StyleSheet } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";
import { scheduleOnRN } from "react-native-worklets";
import {
  BRAND_SPLASH_FADE_MS,
  BRAND_SPLASH_MIN_MS,
  BRAND_SPLASH_REVEAL_MS,
  hideNativeSplash,
} from "@/shared/splash";
import { brandSplashDismissDelay, splashGate } from "@/shared/splash-gate";
import {
  buildSplashScene,
  NATIVE_SPLASH_PIN_HEIGHT,
  SPLASH_PIN_GROWTH,
} from "@/shared/splash-scene";
import { brandColors } from "@/shared/theme";

/** Pin outline in the 1024-unit icon artwork (same geometry as the app icon). */
const PIN_PATH = "M512,810 L320.0,541.2 A236,236 0 1 1 704.0,541.2 Z";

interface Size {
  width: number;
  height: number;
}

/**
 * Full-screen brand splash drawn over the app while it loads. It starts identical to the native
 * splash (night background, pin in the center), then reveals the icon scene — sky, river and North
 * Star — while the pin grows, and fades out once `hideSplash()` has been called and it has been
 * visible for `BRAND_SPLASH_MIN_MS`. Decorative: hidden from screen readers.
 */
export function BrandSplash() {
  const [size, setSize] = useState<Size | null>(null);
  const [gone, setGone] = useState(false);
  const shownAt = useRef(0);
  const ready = useSyncExternalStore(splashGate.subscribe, splashGate.isReady);
  const reveal = useSharedValue(0);
  const visibility = useSharedValue(1);
  const hasLayout = size !== null;

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  };

  // Once the overlay covers the screen, drop the native splash and start the reveal.
  useEffect(() => {
    if (!hasLayout) return;
    shownAt.current = Date.now();
    hideNativeSplash();
    reveal.value = withTiming(1, {
      duration: BRAND_SPLASH_REVEAL_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [hasLayout, reveal]);

  useEffect(() => {
    if (!ready || !hasLayout) return;
    const delay = brandSplashDismissDelay(Date.now() - shownAt.current, BRAND_SPLASH_MIN_MS);
    const timer = setTimeout(() => {
      visibility.value = withTiming(0, { duration: BRAND_SPLASH_FADE_MS }, (finished) => {
        if (finished) scheduleOnRN(setGone, true);
      });
    }, delay);
    return () => clearTimeout(timer);
  }, [ready, hasLayout, visibility]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: visibility.value }));
  const revealStyle = useAnimatedStyle(() => ({ opacity: reveal.value }));
  // The scene is drawn at its final size and starts scaled down, so it stays sharp at the end.
  const sceneStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(reveal.value, [0, 1], [1 / SPLASH_PIN_GROWTH, 1]) }],
  }));

  if (gone) return null;

  const scene = size
    ? buildSplashScene({ ...size, pinHeight: NATIVE_SPLASH_PIN_HEIGHT * SPLASH_PIN_GROWTH })
    : null;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.base, overlayStyle]}
      onLayout={onLayout}
      pointerEvents={ready ? "none" : "auto"}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <StatusBar style="light" />
      {size && scene ? (
        <>
          <Animated.View style={[StyleSheet.absoluteFill, revealStyle]}>
            <Svg width={size.width} height={size.height}>
              <Defs>
                <LinearGradient id="splashSky" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={brandColors.skyTop} />
                  <Stop offset="1" stopColor={brandColors.skyBottom} />
                </LinearGradient>
              </Defs>
              <Rect width={size.width} height={size.height} fill="url(#splashSky)" />
            </Svg>
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, sceneStyle]}>
            <Animated.View style={[StyleSheet.absoluteFill, revealStyle]}>
              <Svg width={size.width} height={size.height}>
                <Path d={scene.riverNear} fill={brandColors.lake} />
                <Path d={scene.riverFar} fill={brandColors.river} />
                <Path d={scene.star} fill={brandColors.star} />
              </Svg>
            </Animated.View>
            <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill}>
              <PinArt transform={scene.pinTransform} />
            </Svg>
          </Animated.View>
        </>
      ) : null}
    </Animated.View>
  );
}

/** The app icon's pin with the Canada goose inside, in 1024-unit artwork space. */
function PinArt({ transform }: { transform: string }) {
  return (
    <G transform={transform}>
      <Defs>
        <ClipPath id="splashPinClip">
          <Path d={PIN_PATH} />
        </ClipPath>
      </Defs>
      <Path d={PIN_PATH} fill={brandColors.pin} />
      <G clipPath="url(#splashPinClip)">
        <G transform="translate(180 -20)">
          <Ellipse cx={420} cy={700} rx={230} ry={150} fill={brandColors.gooseBreast} />
          <Ellipse
            cx={520}
            cy={740}
            rx={170}
            ry={110}
            fill={brandColors.gooseWing}
            opacity={0.45}
          />
          <Path
            d="M350,612 C336,540 330,450 346,368 L412,370 C402,450 408,522 432,584 Z"
            fill={brandColors.gooseNeck}
          />
          <Path
            d="M412,372 C414,330 396,304 366,300 C336,296 312,306 296,318 L234,340 C252,348 276,352 300,351 C320,360 334,370 346,376 Z"
            fill={brandColors.gooseNeck}
          />
          <Path
            d="M312,356 C336,352 360,340 374,318 C384,306 402,310 400,328 C394,352 362,374 332,374 C318,372 308,364 312,356 Z"
            fill={brandColors.pin}
          />
          <Circle cx={330} cy={318} r={7} fill={brandColors.pin} opacity={0.85} />
        </G>
      </G>
      <Path d={PIN_PATH} fill="none" stroke={brandColors.pin} strokeWidth={18} />
    </G>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: brandColors.night },
});
