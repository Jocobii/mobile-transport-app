import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import {
  type ComposedGesture,
  Gesture,
  GestureDetector,
  type GestureType,
} from "react-native-gesture-handler";
import Animated, {
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import {
  resolveSnap,
  type SheetSnap,
  shouldSheetTakeDrag,
  stepSnap,
  tapSnap,
} from "@/shared/panel/sheet-snap";
import { colors, radii, spacing } from "@/shared/theme";

const HANDLE_AREA_HEIGHT = 48;
const HANDLE_WIDTH = 40;
const HANDLE_HEIGHT = 4;
const SNAP_DURATION_MS = 250;

interface DragGestureOptions {
  /** Also toggle the snap point on a tap (the handle does; areas with buttons inside do not). */
  tap: boolean;
}

interface SheetContextValue {
  /** Builds a fresh drag gesture; one instance per `GestureDetector`, never shared. */
  createDragGesture: (options: DragGestureOptions) => ComposedGesture | GestureType;
  /**
   * Builds the pan that runs alongside a list's own scrolling: a downward drag while the list is
   * at its top (`scrollY <= 0`) lowers the sheet; anything else is left to the list.
   */
  createContentPanGesture: (scrollY: SharedValue<number>) => GestureType;
}

const SheetContext = createContext<SheetContextValue | undefined>(undefined);

/**
 * Makes its children drag the sheet (both directions, same snapping as the handle).
 * Outside a sheet it renders the children untouched. Used by panel headers.
 */
export function SheetDragArea({ children }: { children: ReactNode }) {
  const sheet = useContext(SheetContext);
  const gesture = useMemo(() => sheet?.createDragGesture({ tap: false }), [sheet]);
  if (!gesture) return <>{children}</>;
  return (
    <GestureDetector gesture={gesture}>
      <View collapsable={false}>{children}</View>
    </GestureDetector>
  );
}

/**
 * Wiring for a scrollable list inside a sheet: pass `scrollHandler` as the (reanimated) list's
 * `onScroll` and wrap the list in a `GestureDetector` with `scrollGesture`. Outside a sheet the
 * list simply scrolls.
 */
export function useSheetScroll() {
  const sheet = useContext(SheetContext);
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const scrollGesture = useMemo(() => {
    const native = Gesture.Native();
    if (!sheet) return native;
    return Gesture.Simultaneous(native, sheet.createContentPanGesture(scrollY));
  }, [sheet, scrollY]);
  return { scrollGesture, scrollHandler };
}

interface BottomSheetProps {
  snap: SheetSnap;
  /** Visible height (dp) at each snap point; `full` is also the height of the sheet itself. */
  heights: Record<SheetSnap, number>;
  onSnapChange: (snap: SheetSnap) => void;
  children: ReactNode;
}

/**
 * Draggable bottom sheet with three snap points (in-house: `react-native-gesture-handler` +
 * `react-native-reanimated`). The handle and every `SheetDragArea` (panel headers) drag it.
 * The content area is sized to the current snap height, so lists never extend off screen.
 */
export function BottomSheet({ snap, heights, onSnapChange, children }: BottomSheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const fullHeight = heights.full;
  const collapsedOffset = fullHeight - heights.collapsed;
  const halfOffset = fullHeight - heights.half;
  const targetOffset = snap === "full" ? 0 : snap === "half" ? halfOffset : collapsedOffset;

  const translateY = useSharedValue(targetOffset);
  const startY = useSharedValue(0);
  const takingDrag = useSharedValue(false);
  const takeBaseY = useSharedValue(0);
  const lastTranslationY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withTiming(targetOffset, { duration: SNAP_DURATION_MS });
  }, [targetOffset, translateY]);

  /** Springs to the snap point that matches where the sheet was released. */
  const settle = useCallback(
    (velocityY: number) => {
      "worklet";
      const next = resolveSnap(translateY.value, velocityY, {
        full: 0,
        half: halfOffset,
        collapsed: collapsedOffset,
      });
      const offset = next === "full" ? 0 : next === "half" ? halfOffset : collapsedOffset;
      translateY.value = withSpring(offset, { damping: 20, stiffness: 200 });
      scheduleOnRN(onSnapChange, next);
    },
    [collapsedOffset, halfOffset, onSnapChange, translateY],
  );

  const createContentPanGesture = useCallback(
    (scrollY: SharedValue<number>) =>
      Gesture.Pan()
        .activeOffsetY([-10, 10])
        .onStart((event) => {
          startY.value = translateY.value;
          takingDrag.value = false;
          lastTranslationY.value = event.translationY;
        })
        .onUpdate((event) => {
          const change = event.translationY - lastTranslationY.value;
          lastTranslationY.value = event.translationY;
          if (!takingDrag.value) {
            if (!shouldSheetTakeDrag(scrollY.value, change)) return;
            // The list just reached its top: the sheet follows from here, not from the finger's
            // earlier travel (which scrolled the list).
            takingDrag.value = true;
            takeBaseY.value = event.translationY - change;
          }
          const delta = Math.max(0, event.translationY - takeBaseY.value);
          translateY.value = Math.min(collapsedOffset, Math.max(0, startY.value + delta));
        })
        .onEnd((event) => {
          if (takingDrag.value) settle(event.velocityY);
        })
        .onFinalize(() => {
          takingDrag.value = false;
        }),
    [collapsedOffset, lastTranslationY, settle, startY, takeBaseY, takingDrag, translateY],
  );

  const createDragGesture = useCallback(
    ({ tap: withTap }: DragGestureOptions) => {
      const pan = Gesture.Pan()
        .minDistance(4)
        .onStart(() => {
          startY.value = translateY.value;
        })
        .onUpdate((event) => {
          translateY.value = Math.min(
            collapsedOffset,
            Math.max(0, startY.value + event.translationY),
          );
        })
        .onEnd((event) => {
          settle(event.velocityY);
        });
      if (!withTap) return pan;
      const tap = Gesture.Tap()
        .maxDuration(250)
        .onEnd((_event, success) => {
          if (success) scheduleOnRN(onSnapChange, tapSnap(snap));
        });
      return Gesture.Race(pan, tap);
    },
    [collapsedOffset, onSnapChange, settle, snap, startY, translateY],
  );
  const handleGesture = useMemo(() => createDragGesture({ tap: true }), [createDragGesture]);
  const sheetContext = useMemo(
    () => ({ createDragGesture, createContentPanGesture }),
    [createDragGesture, createContentPanGesture],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.sheet, { height: fullHeight }, animatedStyle]}>
      <GestureDetector gesture={handleGesture}>
        <View
          style={styles.handleArea}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={t("sheet.handleLabel")}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(event) => {
            const action = event.nativeEvent.actionName;
            if (action === "increment") onSnapChange(stepSnap(snap, "up"));
            if (action === "decrement") onSnapChange(stepSnap(snap, "down"));
          }}
        >
          <View style={styles.handle} />
        </View>
      </GestureDetector>
      <View
        style={[
          styles.content,
          { height: heights[snap] - HANDLE_AREA_HEIGHT, paddingBottom: insets.bottom },
        ]}
      >
        <SheetContext.Provider value={sheetContext}>{children}</SheetContext.Provider>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radii.panel,
    borderTopRightRadius: radii.panel,
    backgroundColor: colors.surface,
    elevation: 8,
    shadowColor: colors.ink,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
  },
  handleArea: {
    height: HANDLE_AREA_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  handle: {
    width: HANDLE_WIDTH,
    height: HANDLE_HEIGHT,
    borderRadius: HANDLE_HEIGHT / 2,
    backgroundColor: colors.line,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
});
