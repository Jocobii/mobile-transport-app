import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { resolveSnap, type SheetSnap, stepSnap } from "@/shared/panel/sheet-snap";
import { colors, radii, spacing } from "@/shared/theme";

const HANDLE_AREA_HEIGHT = 28;
const HANDLE_WIDTH = 40;
const HANDLE_HEIGHT = 4;
const SNAP_DURATION_MS = 250;

interface BottomSheetProps {
  snap: SheetSnap;
  /** Visible height (dp) at each snap point; `full` is also the height of the sheet itself. */
  heights: Record<SheetSnap, number>;
  onSnapChange: (snap: SheetSnap) => void;
  children: ReactNode;
}

/**
 * Draggable bottom sheet with three snap points (in-house: `react-native-gesture-handler` +
 * `react-native-reanimated`). Only the handle drags, so lists inside keep scrolling normally.
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

  useEffect(() => {
    translateY.value = withTiming(targetOffset, { duration: SNAP_DURATION_MS });
  }, [targetOffset, translateY]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
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
          const next = resolveSnap(translateY.value, event.velocityY, {
            full: 0,
            half: halfOffset,
            collapsed: collapsedOffset,
          });
          const offset = next === "full" ? 0 : next === "half" ? halfOffset : collapsedOffset;
          translateY.value = withSpring(offset, { damping: 20, stiffness: 200 });
          scheduleOnRN(onSnapChange, next);
        }),
    [collapsedOffset, halfOffset, onSnapChange, startY, translateY],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.sheet, { height: fullHeight }, animatedStyle]}>
      <GestureDetector gesture={pan}>
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
        {children}
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
